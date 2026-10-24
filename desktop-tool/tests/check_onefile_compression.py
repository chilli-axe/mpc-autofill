"""Check Nuitka's actual compressor before compiling; print required compatibility flags."""

import io
import os
from compression import zstd
from contextlib import redirect_stdout

from nuitka.tools.onefile_compressor.OnefileCompressor import getCompressorFunction


def main() -> None:
    jobs = os.cpu_count() or 1
    low_memory = zstd.CompressionParameter.nb_workers.bounds()[1] == 0
    payload = b"desktop onefile compression probe\0" * 32
    with io.BytesIO() as output, redirect_stdout(io.StringIO()):
        marker, compress = getCompressorFunction(True, low_memory, jobs)
        assert marker == b"Y", "Onefile compression must remain enabled"
        with compress(output) as stream:
            stream.write(payload)
        assert zstd.decompress(output.getvalue()) == payload
    if low_memory:
        # Keep parallel C compilation when low-memory mode selects single-threaded compression.
        print(f"--low-memory --jobs={jobs}")


if __name__ == "__main__":
    main()
