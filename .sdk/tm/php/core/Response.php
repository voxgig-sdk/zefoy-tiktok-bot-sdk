<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK response

class ZefoyTiktokBotResponse
{
    public int $status;
    public string $status_text;
    public mixed $headers;
    public mixed $json_func;
    public mixed $body;
    public mixed $err;

    public function __construct(array $resmap = [])
    {
        $s = \Voxgig\Struct\Struct::getprop($resmap, 'status');
        $this->status = is_numeric($s) ? (int)$s : -1;
        $st = \Voxgig\Struct\Struct::getprop($resmap, 'statusText');
        $this->status_text = is_string($st) ? $st : '';
        $h = \Voxgig\Struct\Struct::getprop($resmap, 'headers');
        $this->headers = ($h === '__UNDEFINED__') ? null : $h;
        $jf = \Voxgig\Struct\Struct::getprop($resmap, 'json');
        $this->json_func = is_callable($jf) ? $jf : null;
        $b = \Voxgig\Struct\Struct::getprop($resmap, 'body');
        $this->body = ($b === '__UNDEFINED__') ? null : $b;
        $e = \Voxgig\Struct\Struct::getprop($resmap, 'err');
        $this->err = ($e === '__UNDEFINED__') ? null : $e;
    }
}
