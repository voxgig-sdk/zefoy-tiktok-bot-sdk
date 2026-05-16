<?php
declare(strict_types=1);

// ProjectName SDK test feature

require_once __DIR__ . '/BaseFeature.php';
require_once __DIR__ . '/../utility/Param.php';

class ProjectNameTestFeature extends ProjectNameBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'test';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ProjectNameContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;

        $entity_data = \Voxgig\Struct\Struct::getprop($options, 'entity');
        if (!is_array($entity_data)) {
            $entity_data = [];
        }

        $this->client->mode = 'test';

        // Ensure entity ids are correct.
        \Voxgig\Struct\Struct::walk($entity_data, function ($key, $val, $parent, $path) {
            if (count($path) === 2 && is_array($val) && $key !== null) {
                $val['id'] = $key;
            }
            return $val;
        });

        // Wrap in object so closure mutations persist (PHP arrays are value types).
        $entity = new \stdClass();
        $entity->data = $entity_data;

        $test_fetcher = function (ProjectNameContext $fctx, string $_fullurl, array $_fetchdef) use ($entity): array {
            $respond = function (int $status, mixed $data, ?array $extra = null): array {
                $out = [
                    'status' => $status,
                    'statusText' => 'OK',
                    'json' => function () use ($data) { return $data; },
                    'body' => 'not-used',
                ];
                if ($extra) {
                    foreach ($extra as $k => $v) {
                        $out[$k] = $v;
                    }
                }
                return [$out, null];
            };

            $op = $fctx->op;
            $entname = $op->entity;
            $entmap = is_array($entity->data[$entname] ?? null) ? $entity->data[$entname] : [];

            // PHP-portable equivalent of TS buildArgs+select: a flat-key
            // filter that matches by exact-equality on each provided key,
            // with alias fallback. Empty match matches all entries — load
            // with empty match returns the first fixture entry (or last
            // create), list returns all entries.
            $find_first = function (array $entmap, $match, $alias) {
                if (!is_array($match) || empty($match)) {
                    foreach ($entmap as $e) {
                        if (is_array($e)) return $e;
                    }
                    return null;
                }
                foreach ($entmap as $e) {
                    if (!is_array($e)) continue;
                    $ok = true;
                    foreach ($match as $k => $v) {
                        if ($v === null || $v === '__UNDEFINED__') continue;
                        $ev = $e[$k] ?? null;
                        if ($ev !== $v) {
                            // Try alias key if any
                            $ka = is_array($alias) ? ($alias[$k] ?? null) : null;
                            $aliased = ($ka !== null) ? ($e[$ka] ?? null) : null;
                            if ($aliased !== $v) {
                                $ok = false;
                                break;
                            }
                        }
                    }
                    if ($ok) return $e;
                }
                return null;
            };

            $find_all = function (array $entmap, $match, $alias) use ($find_first) {
                if (!is_array($match) || empty($match)) {
                    return array_values(array_filter($entmap, 'is_array'));
                }
                $out = [];
                foreach ($entmap as $e) {
                    if (!is_array($e)) continue;
                    $ok = true;
                    foreach ($match as $k => $v) {
                        if ($v === null || $v === '__UNDEFINED__') continue;
                        $ev = $e[$k] ?? null;
                        if ($ev !== $v) {
                            $ka = is_array($alias) ? ($alias[$k] ?? null) : null;
                            $aliased = ($ka !== null) ? ($e[$ka] ?? null) : null;
                            if ($aliased !== $v) { $ok = false; break; }
                        }
                    }
                    if ($ok) $out[] = $e;
                }
                return $out;
            };

            $alias = is_object($op) ? ($op->alias ?? null) : \Voxgig\Struct\Struct::getprop($op, 'alias');

            // For single-entity ops (load, remove) with an empty explicit
            // match, fall back to the id the entity client already knows from a
            // prior create/load (carried in $fctx->match / $fctx->data). This
            // mirrors the TS mock where param() resolves the id from that
            // accumulated state — e.g. `create()` then `remove([])` removes the
            // just-created entity, not an arbitrary fixture.
            $resolve_match = function ($explicit) use ($fctx) {
                if (is_array($explicit) && !empty($explicit)) return $explicit;
                foreach ([$fctx->match, $fctx->data] as $src) {
                    $arr = is_array($src) ? $src : (is_object($src) ? (array) $src : []);
                    if (isset($arr['id']) && $arr['id'] !== null && $arr['id'] !== '__UNDEFINED__') {
                        return ['id' => $arr['id']];
                    }
                }
                return [];
            };

            if ($op->name === 'load') {
                $ent = $find_first($entmap, $resolve_match($fctx->reqmatch), $alias);
                if ($ent === null) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                if (is_array($ent)) unset($ent['$KEY']);
                $out = \Voxgig\Struct\Struct::clone($ent);
                return $respond(200, $out);

            } elseif ($op->name === 'list') {
                $found = $find_all($entmap, $fctx->reqmatch, $alias);
                $cleaned = [];
                foreach ($found as $e) {
                    if (is_array($e)) unset($e['$KEY']);
                    $cleaned[] = $e;
                }
                $out = \Voxgig\Struct\Struct::clone($cleaned);
                return $respond(200, $out);

            } elseif ($op->name === 'update') {
                // Match the existing entity by id only (or its alias). reqdata
                // also contains the new field values, which would otherwise
                // cause find_first to filter out the entity we want to update.
                $update_match = [];
                if (is_array($fctx->reqdata)) {
                    if (array_key_exists('id', $fctx->reqdata)) {
                        $update_match['id'] = $fctx->reqdata['id'];
                    }
                    $id_alias = is_array($alias) ? ($alias['id'] ?? null) : null;
                    if ($id_alias !== null && array_key_exists($id_alias, $fctx->reqdata)) {
                        $update_match[$id_alias] = $fctx->reqdata[$id_alias];
                    }
                }
                $ent = $find_first($entmap, $update_match, $alias);
                if ($ent === null) {
                    return $respond(404, null, ['statusText' => 'Not found']);
                }
                if (is_array($fctx->reqdata)) {
                    foreach ($fctx->reqdata as $k => $v) {
                        $ent[$k] = $v;
                    }
                }
                $id = is_array($ent) ? ($ent['id'] ?? null) : null;
                if ($id !== null) {
                    $entmap[$id] = $ent;
                    $entity->data[$entname] = $entmap;
                }
                if (is_array($ent)) unset($ent['$KEY']);
                $out = \Voxgig\Struct\Struct::clone($ent);
                return $respond(200, $out);

            } elseif ($op->name === 'remove') {
                $ent = $find_first($entmap, $resolve_match($fctx->reqmatch), $alias);
                // Remove only the first matched entity. If nothing matches,
                // succeed as a no-op rather than erroring.
                $id = is_array($ent) ? ($ent['id'] ?? null) : null;
                if ($id !== null) {
                    unset($entmap[$id]);
                    $entity->data[$entname] = $entmap;
                }
                return $respond(200, null);

            } elseif ($op->name === 'create') {
                $id = ProjectNameParam::call($fctx, 'id');
                if ($id === null || $id === '__UNDEFINED__') {
                    $id = sprintf('%04x%04x%04x%04x',
                        random_int(0, 0xFFFF), random_int(0, 0xFFFF),
                        random_int(0, 0xFFFF), random_int(0, 0xFFFF));
                }

                $ent = is_array($fctx->reqdata) ? $fctx->reqdata : [];
                $ent['id'] = $id;
                $entmap[$id] = $ent;
                $entity->data[$entname] = $entmap;
                if (is_array($ent)) unset($ent['$KEY']);
                $out = \Voxgig\Struct\Struct::clone($ent);
                return $respond(200, $out);

            } else {
                return $respond(404, null, ['statusText' => 'Unknown operation']);
            }
        };

        $ctx->utility->fetcher = $test_fetcher;
    }

    /**
     * Build a structured `$AND` query from the request match/data dict,
     * matching the TS test feature's buildArgs. Mirrors ts/src/feature/test/TestFeature.ts:158-204.
     *
     * For each key in $args that is 'id' OR a required-param key on the
     * current operation point, emit a `$OR` clause matching the key (and
     * its alias, if any) against the supplied value.
     */
    public function buildArgs(ProjectNameContext $ctx, $op, $args): array
    {
        // If args is empty/missing, return an empty $AND so select() matches
        // every entry — the TS test feature relies on this for empty-match
        // load against fixture entries.
        $keys = is_array($args) ? \Voxgig\Struct\Struct::keysof($args) : [];
        if (empty($keys)) {
            return ['$AND' => []];
        }

        $opname = is_object($op) ? ($op->name ?? null) : (\Voxgig\Struct\Struct::getprop($op, 'name'));
        $entityName = null;
        if (isset($ctx->entity)) {
            $entityName = is_object($ctx->entity)
                ? ($ctx->entity->name ?? null)
                : (is_array($ctx->entity) ? ($ctx->entity['name'] ?? null) : null);
        }

        // Resolve required-param names from the op's last point. Defensive:
        // any missing piece falls back to "no required params".
        $reqd_names = [];
        if (is_string($opname) && is_string($entityName) && isset($ctx->config)) {
            $points = \Voxgig\Struct\Struct::getpath(
                ['entity', $entityName, 'op', $opname, 'points'],
                $ctx->config
            );
            $point = \Voxgig\Struct\Struct::getelem($points, -1);
            $params = is_array($point) ? ($point['args']['params'] ?? null) : null;
            if (is_array($params)) {
                foreach ($params as $p) {
                    if (is_array($p) && (($p['reqd'] ?? false) === true)) {
                        $n = $p['name'] ?? null;
                        if ($n !== null) {
                            $reqd_names[] = $n;
                        }
                    }
                }
            }
        }

        $alias = is_object($op) ? ($op->alias ?? null) : \Voxgig\Struct\Struct::getprop($op, 'alias');
        $qand = [];

        foreach ($keys as $k) {
            $is_id = ($k === 'id');
            $in_reqd = in_array($k, $reqd_names, true);
            if ($is_id || $in_reqd) {
                $v = ProjectNameParam::call($ctx, $k);
                $ka = \Voxgig\Struct\Struct::getprop($alias, $k);

                $qor = [[$k => $v]];
                if ($ka !== null) {
                    $qor[] = [$ka => $v];
                }

                $qand[] = ['$OR' => $qor];
            }
        }

        return ['$AND' => $qand];
    }
}
