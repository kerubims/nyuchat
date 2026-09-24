import os
import onnx
from onnx import numpy_helper, TensorProto

# Machine has 3.8GB RAM; int8 dynamic quantization of the 2.2GB reranker OOMs.
# fp16 halves weights to ~1.1GB and gives ~1.5-2x speedup on CPU while keeping
# ranking quality (scores are compared, not summed).
src = '/home/ubs/uchat/onnx/reranker/reranker.onnx'
dst = '/home/ubs/uchat/onnx/reranker/reranker_fp16.onnx'
print('loading graph...', flush=True)
m = onnx.load(src)

converted = 0
for init in m.graph.initializer:
    if init.data_type == TensorProto.FLOAT:
        arr = numpy_helper.to_array(init)
        fp16 = arr.astype('float16')
        init.CopyFrom(numpy_helper.from_array(fp16, name=init.name))
        converted += 1

print('converted to fp16:', converted, 'initializers', flush=True)
onnx.save(m, dst)
print('output MB:', os.path.getsize(dst) // 1024 // 1024, flush=True)
print('DONE', flush=True)
