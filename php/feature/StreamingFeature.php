<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK streaming feature

require_once __DIR__ . '/BaseFeature.php';

// Streaming result support. For list-style operations it attaches a
// `$result->stream` closure returning a PHP Generator so callers can
// consume items incrementally with `foreach (($result->stream)() as $item)`
// instead of materialising the whole array. The generator reads the
// result's data lazily, so it reflects the parsed entities. A `chunkDelay`
// (ms) simulates paced/chunked delivery via the injectable `sleep`; a
// `chunkSize` groups items into batches when set. Mirrors
// ts/src/feature/streaming/StreamingFeature.ts.
class ZefoyTiktokBotStreamingFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'streaming';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
    }

    public function PreResult(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || !$this->_streamable($ctx)) {
            return;
        }
        $result = $ctx->result;
        if ($result === null) {
            return;
        }

        $result->streaming = true;
        $result->stream = function () use ($result): \Generator {
            return $this->_iterate($result);
        };

        $client = $this->client;
        if (!isset($client->_streaming)) {
            $client->_streaming = ['opened' => 0];
        }
        $client->_streaming['opened']++;
    }

    private function _iterate(ZefoyTiktokBotResult $result): \Generator
    {
        $chunk_delay = is_numeric($this->options['chunkDelay'] ?? null)
            ? (float)$this->options['chunkDelay'] : 0.0;
        $chunk_size = is_numeric($this->options['chunkSize'] ?? null)
            ? (int)$this->options['chunkSize'] : 0;

        // Read lazily so downstream result processing is reflected.
        $items = is_array($result->resdata) ? array_values($result->resdata) : [];

        if ($chunk_size > 0) {
            $count = count($items);
            for ($i = 0; $i < $count; $i += $chunk_size) {
                if ($chunk_delay > 0) {
                    $this->_sleep($chunk_delay);
                }
                yield array_slice($items, $i, $chunk_size);
            }
            return;
        }

        foreach ($items as $item) {
            if ($chunk_delay > 0) {
                $this->_sleep($chunk_delay);
            }
            yield $item;
        }
    }

    private function _streamable(ZefoyTiktokBotContext $ctx): bool
    {
        $ops = $this->options['ops'] ?? ['list'];
        return is_array($ops) && in_array($ctx->op->name, $ops, true);
    }

    private function _sleep(mixed $ms): void
    {
        if (!is_numeric($ms) || $ms <= 0) {
            return;
        }
        $sleep = $this->options['sleep'] ?? null;
        if (is_callable($sleep)) {
            $sleep($ms);
            return;
        }
        usleep((int)($ms * 1000));
    }
}
