#!/usr/bin/env python3
"""fp16 converter for the 2.2GB reranker ONNX — streaming, low RAM.

Structure of the export: reranker.onnx (216KB graph) + reranker.onnx.data
(2.2GB blob). TensorProto entries in the graph carry data_location=EXTERNAL
with location/offset/length pointing into the blob, and raw_data empty.

Whole-graph conversion OOMs (3.8GB RAM) and protobuf refuses to serialize
>2GB. Instead: load the graph without external data, then for each fp32
initializer stream its slice from the blob, convert to fp16, append to a new
blob, and update the initializer's offset/length. Peak RAM = one tensor
(largest = word embeddings, 256M floats = 1GB... still too big, so chunk it).
"""
import os
import mmap
import numpy as np
import onnx
from onnx import TensorProto

ONNX = '/home/ubs/uchat/onnx/reranker/reranker.onnx'
DATA = '/home/ubs/uchat/onnx/reranker/reranker.onnx.data'
OUT = '/home/ubs/uchat/onnx/reranker/reranker_fp16.onnx'
OUTDATA = '/home/ubs/uchat/onnx/reranker/reranker_fp16.onnx.data'

DT_FLOAT = 1
DT_FLOAT16 = 10
CHUNK = 16 * 1024 * 1024  # 16M floats per read


def main():
    m = onnx.load(ONNX, load_external_data=False)  # blob stays on disk
    print('graph loaded; initializers:', len(m.graph.initializer), flush=True)

    src = open(DATA, 'rb')
    srcmm = mmap.mmap(src.fileno(), 0, prot=mmap.PROT_READ)

    dst = open(OUTDATA, 'wb')
    # keep blob start padded so offsets stay aligned like the original
    dst.write(b'\x00' * 0)

    converted = 0
    total_bytes = 0
    for init in m.graph.initializer:
        if init.data_type != DT_FLOAT:
            continue
        if not init.HasField('data_location'):
            # inline tensor (small): convert in place
            if init.raw_data:
                arr = np.frombuffer(init.raw_data, dtype='<f4').astype('<f2')
                init.raw_data = arr.tobytes()
                init.data_type = DT_FLOAT16
                converted += 1
            continue

        kv = {e.key: e.value for e in init.external_data}
        if 'offset' not in kv or 'length' not in kv:
            continue

        off = int(kv['offset'])
        ln = int(kv['length'])
        if ln == 0:
            continue

        new_off = dst.tell()
        n_floats = ln // 4
        pos = off
        end = off + ln
        while pos < end:
            nxt = min(pos + CHUNK * 4, end)
            a = np.frombuffer(srcmm[pos:nxt], dtype='<f4').astype('<f2')
            dst.write(a.tobytes())
            pos = nxt

        # rewrite the initializer to point at the new fp16 blob
        init.data_type = DT_FLOAT16
        for e in list(init.external_data):
            init.external_data.remove(e)
        init.external_data.add(key='location', value=os.path.basename(OUTDATA))
        init.external_data.add(key='offset', value=str(new_off))
        init.external_data.add(key='length', value=str(n_floats * 2))
        converted += 1
        total_bytes += n_floats * 2
        if converted % 25 == 0:
            print(f'{converted} tensors, {total_bytes / 1024 / 1024:.0f}MB written', flush=True)

    print(f'converted {converted} tensors', flush=True)

    # remove inline raw_data on external tensors (offsets now describe the blob)
    onnx.save_model(m, OUT, save_as_external_data=False)
    dst.close()
    srcmm.close()
    src.close()
    print(f'graph {os.path.getsize(OUT) / 1024 / 1024:.1f}MB '
          f'blob {os.path.getsize(OUTDATA) / 1024 / 1024:.0f}MB', flush=True)
    print('DONE', flush=True)


if __name__ == '__main__':
    main()
