import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioDeck, type SoundCue } from "../apps/clone/src/audio-deck.js";

const cueNames: SoundCue[] = [
  "theme", "expand", "keyboard", "panels", "stdin", "stdout", "folder",
  "granted", "scan", "alarm", "denied", "error", "info"
];

interface FakeSource {
  buffer: AudioBuffer | null;
  onended: (() => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function createAudioHarness(failingCue?: SoundCue) {
  const fetchedUrls: string[] = [];
  const decodedBuffers: AudioBuffer[] = [];
  const sources: FakeSource[] = [];
  const resume = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const context = {
    state: "suspended",
    destination: {},
    resume,
    close,
    decodeAudioData: vi.fn(async () => {
      const buffer = { id: decodedBuffers.length } as unknown as AudioBuffer;
      decodedBuffers.push(buffer);
      return buffer;
    }),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn()
    })),
    createBufferSource: vi.fn(() => {
      const source: FakeSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      sources.push(source);
      return source;
    })
  } as unknown as AudioContext;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchedUrls.push(url);
    if (failingCue && url.endsWith(`/${failingCue}.wav`)) throw new TypeError("network unavailable");
    return new Response(new Uint8Array([82, 73, 70, 70]));
  }) as typeof fetch;
  const soundEvents: Array<{ cue: SoundCue; enabled: boolean; volume: number }> = [];
  const deck = new AudioDeck({
    context,
    fetcher,
    emitSoundEvent: (event) => soundEvents.push(event)
  });
  return { deck, context, fetchedUrls, decodedBuffers, sources, resume, close, soundEvents };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AudioDeck", () => {
  it("loads and decodes each cue once, then reuses its buffer for overlapping playback", async () => {
    const harness = createAudioHarness();

    await harness.deck.unlock();
    harness.deck.play("stdin");
    harness.deck.play("stdin");

    await vi.waitFor(() => expect(harness.sources).toHaveLength(2));
    expect(harness.fetchedUrls).toHaveLength(cueNames.length);
    for (const cue of cueNames) {
      expect(harness.fetchedUrls.filter((url) => url.endsWith(`/${cue}.wav`))).toHaveLength(1);
    }
    expect(harness.decodedBuffers).toHaveLength(cueNames.length);
    expect(harness.sources[0]!.buffer).toBe(harness.sources[1]!.buffer);
    expect(harness.sources.every((source) => source.start.mock.calls.length === 1)).toBe(true);
    expect(harness.resume).toHaveBeenCalledTimes(1);
  });

  it("remembers a failed preload instead of retrying the same network request on every play", async () => {
    const harness = createAudioHarness("folder");

    await expect(harness.deck.unlock()).resolves.toBeUndefined();
    harness.deck.play("folder");
    harness.deck.play("folder");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.fetchedUrls.filter((url) => url.endsWith("/folder.wav"))).toHaveLength(1);
    expect(harness.sources).toHaveLength(0);
  });

  it("stops active sounds when muted and releases the audio graph when disposed", async () => {
    const harness = createAudioHarness();
    await harness.deck.unlock();
    harness.deck.play("scan");
    await vi.waitFor(() => expect(harness.sources).toHaveLength(1));

    harness.deck.setEnabled(false);
    harness.deck.play("scan");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.sources).toHaveLength(1);
    expect(harness.sources[0]!.stop).toHaveBeenCalledTimes(1);
    expect(harness.soundEvents.at(-1)).toMatchObject({ cue: "scan", enabled: false });

    harness.deck.dispose();
    expect(harness.close).toHaveBeenCalledTimes(1);
  });
});
