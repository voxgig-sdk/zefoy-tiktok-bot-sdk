<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK error

class ZefoyTiktokBotError extends \Exception
{
    public bool $is_sdk_error;
    public string $sdk;
    public string $sdk_code;
    public string $msg;
    public mixed $ctx;
    public mixed $result;
    public mixed $spec;

    // HTTP status of the response that caused this error, or -1 when the
    // request never got one. Promoted to the top level so a consumer can
    // branch on `err->status` / `err->notFound()` instead of reaching into
    // `err->result`.
    //
    // DECLARED, not created on assignment. makeError set it on an undeclared
    // property, which PHP 8.2 deprecates and PHP 9 makes fatal - so every
    // error path in this SDK was on course to stop working. ts declares the
    // same field; php needs it spelled out because the class is typed.
    public int $status;

    public function __construct(string $code = '', string $msg = '', mixed $ctx = null)
    {
        parent::__construct($msg);
        $this->is_sdk_error = true;
        $this->sdk = 'ZefoyTiktokBot';
        $this->sdk_code = $code;
        $this->msg = $msg;
        $this->ctx = $ctx;
        $this->result = null;
        $this->spec = null;
        $this->status = -1;
    }

    public function error(): string
    {
        return $this->msg;
    }

    public function __toString(): string
    {
        return $this->msg;
    }
}
