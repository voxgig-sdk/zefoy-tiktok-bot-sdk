<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK result

class ZefoyTiktokBotResult
{
    public bool $ok;
    public int $status;
    public string $status_text;
    public array $headers;
    public mixed $body;
    public mixed $err;
    public mixed $resdata;
    public ?array $resmatch;

    // Feature extensions: pagination info (paging feature) and a Generator
    // factory closure (streaming feature). Null/false when the features are
    // inactive or the operation is not a list.
    public mixed $paging;
    public bool $streaming;
    public mixed $stream;

    public function __construct(array $resmap = [])
    {
        $this->ok = \Voxgig\Struct\Struct::getprop($resmap, 'ok') === true;
        $s = \Voxgig\Struct\Struct::getprop($resmap, 'status');
        $this->status = is_numeric($s) ? (int)$s : -1;
        $st = \Voxgig\Struct\Struct::getprop($resmap, 'statusText');
        $this->status_text = is_string($st) ? $st : '';
        $h = \Voxgig\Struct\Struct::getprop($resmap, 'headers');
        $this->headers = is_array($h) ? $h : [];
        $b = \Voxgig\Struct\Struct::getprop($resmap, 'body');
        $this->body = ($b === '__UNDEFINED__') ? null : $b;
        $e = \Voxgig\Struct\Struct::getprop($resmap, 'err');
        $this->err = ($e === '__UNDEFINED__') ? null : $e;
        $rd = \Voxgig\Struct\Struct::getprop($resmap, 'resdata');
        $this->resdata = ($rd === '__UNDEFINED__' || $rd === null) ? null : $rd;
        $rm = \Voxgig\Struct\Struct::getprop($resmap, 'resmatch');
        $this->resmatch = is_array($rm) ? $rm : null;
        $this->paging = null;
        $this->streaming = false;
        $this->stream = null;
    }
}
