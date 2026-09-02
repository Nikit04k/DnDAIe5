import sys
import asyncio
import os
import edge_tts

async def main():
    if len(sys.argv) < 3:
        print("Usage: python edge_tts_synth.py <text_or_file> <output_mp3> [voice] [rate]", file=sys.stderr)
        sys.exit(1)

    input_source = sys.argv[1]
    out_path = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "ru-RU-DmitryNeural"
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"

    # If input_source is an existing file, read UTF-8 content from it
    if os.path.isfile(input_source):
        with open(input_source, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = input_source

    if not text.strip():
        print("Empty text", file=sys.stderr)
        sys.exit(1)

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(out_path)
    print("DONE", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
