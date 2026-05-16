<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK operation

class ZefoyTiktokBotOperation
{
    public string $entity;
    public string $name;
    public string $input;
    public array $points;
    public ?array $alias_map;

    public function __construct(array $opmap = [])
    {
        $e = \Voxgig\Struct\Struct::getprop($opmap, 'entity');
        $this->entity = (is_string($e) && $e !== '') ? $e : '_';
        $n = \Voxgig\Struct\Struct::getprop($opmap, 'name');
        $this->name = (is_string($n) && $n !== '') ? $n : '_';
        $i = \Voxgig\Struct\Struct::getprop($opmap, 'input');
        $this->input = (is_string($i) && $i !== '') ? $i : '_';

        $this->points = [];
        $raw_points = \Voxgig\Struct\Struct::getprop($opmap, 'points');
        if (is_array($raw_points)) {
            foreach ($raw_points as $t) {
                if (is_array($t)) {
                    $this->points[] = $t;
                }
            }
        }

        $raw_alias = \Voxgig\Struct\Struct::getprop($opmap, 'alias');
        $this->alias_map = is_array($raw_alias) ? $raw_alias : null;
    }
}
