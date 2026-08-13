<?php
declare(strict_types=1);

// ProjectName SDK error

class ProjectNameError extends \Exception
{
    public string $code;
    public string $msg;
    public string $sdk;

    // HTTP status of the response that caused this error, or -1 when the
    // request never got one. PROMOTED to the top level: it used to be
    // reachable only at `err->result->status`, so every consumer coupled
    // itself to the internal shape of `result`.
    public int $status = -1;

    public function __construct(string $code = "", string $msg = "")
    {
        parent::__construct($msg);
        $this->code = $code;
        $this->msg = $msg;
        $this->sdk = "ProjectName";
    }

    public function notFound(): bool
    {
        return 404 === $this->status;
    }

    public function error(): string
    {
        return "{$this->sdk}: {$this->code}: {$this->msg}";
    }
}
