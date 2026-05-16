<?php
declare(strict_types=1);

// ProjectName SDK error

class ProjectNameError extends \Exception
{
    public string $code;
    public string $msg;
    public string $sdk;

    public function __construct(string $code = "", string $msg = "")
    {
        parent::__construct($msg);
        $this->code = $code;
        $this->msg = $msg;
        $this->sdk = "ProjectName";
    }

    public function error(): string
    {
        return "{$this->sdk}: {$this->code}: {$this->msg}";
    }
}
