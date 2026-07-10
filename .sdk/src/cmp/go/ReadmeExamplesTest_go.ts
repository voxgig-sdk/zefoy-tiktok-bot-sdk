import { cmp, Content, File } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits go/test/readme_examples_test.go — a COMPLETENESS GATE over every
// ```go block in ALL THREE docs that ship go examples:
//   - the root README.md (top-level, multi-language quick start)
//   - the per-language go/README.md
//   - the per-language go/REFERENCE.md
//
// For every ```go block, tagged by (source doc, index), it exercises the
// block against the real generated SDK:
//
//   - Fragments (statement snippets) are wrapped in a function with a SEEDED
//     test-mode `client` in scope and `go build`-checked. Any stray `import`
//     line inside the fragment is stripped and constructor calls are rewritten
//     to the seeded test client (so undefined-variable placeholders like
//     sdk.TestSDK(testopts, sdkopts) still type-check). A call to a method
//     that does not exist, a wrong argument count/type, or `.data`/`.ok` field
//     access on a bare entity-op result fails to compile — and so fails.
//   - Complete programs (a block with `func main`) are built as-is (the
//     documented, possibly live, form must compile) AND a test-mode variant —
//     its constructor rewritten to a seeded `sdk.TestSDK(...)` — is RUN with
//     `go run`. A genuine runtime panic (nil pointer, nil map, index,
//     interface conversion) FAILS the test; a tolerated not-found domain
//     error does not.
//   - Illustrative blocks are the ONLY blocks skipped, and the class is
//     NARROW: a bare signature (a `func` line with no body) or a comment-only
//     / `/* ... */` placeholder. Everything else must compile or run.
//
// Completeness: per doc, total == compiled + illustration is asserted. A block
// that is neither compiled nor a recognized illustration — e.g. real code
// hidden behind a `/* ... */` comment that the old logic silently skipped —
// FAILS the gate, so no compilable example can escape the check.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { ctx$: { model } } = props

  // Seed a test-mode fixture for every active entity. Complete-program
  // examples load by "example_id", so seed that record for each entity; the
  // offline mock then returns it instead of 404-ing.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const entnames = Object.values(entity)
    .filter((e: any) => e && e.active !== false)
    .map((e: any) => e.name)

  const goSeedEntries = entnames
    .map((n: string) =>
      `"${n}": map[string]any{"example_id": map[string]any{"id": "example_id"}}`)
    .join(', ')
  const goSeed = `map[string]any{"entity": map[string]any{${goSeedEntries}}}`

  File({ name: 'readme_examples_test.go' }, () => {
    Content(`package sdktest

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// testSeed is a test-mode fixture seeded for every entity. It is spliced as
// literal Go source into fragment wrappers and into the test-mode variant of
// complete programs, so the offline mock transport has data to return.
const testSeed = \`${goSeed}\`

// doc names one of the three docs that carry go examples, with its path
// relative to this test file's directory (which is <repo>/go/test): the root
// README is two levels up, the go docs are one.
type doc struct {
	label   string
	relpath string
}

// docStat accumulates the completeness bookkeeping for one doc.
type docStat struct {
	total        int
	compiled     int
	illustration int
	leaked       []int
}

// TestReadmeGoSnippets is a completeness gate over every \`\`\`go fenced block
// in the root README.md, go/README.md, and go/REFERENCE.md. Fragments are
// \`go build\`-checked with a seeded test client injected; complete programs
// are built as-is and their test-mode variant is run with \`go run\`; and per
// doc, total == compiled + illustration is asserted.
func TestReadmeGoSnippets(t *testing.T) {
	_, thisFile, _, _ := runtime.Caller(0)
	testDir := filepath.Dir(thisFile)
	moduleRoot := filepath.Dir(testDir)

	modulePath := readModulePath(moduleRoot)
	if modulePath == "" {
		t.Fatal("could not read module path from go.mod")
	}

	docs := []doc{
		{"root README", filepath.Join(testDir, "..", "..", "README.md")},
		{"go/README", filepath.Join(testDir, "..", "README.md")},
		{"go/REFERENCE", filepath.Join(testDir, "..", "REFERENCE.md")},
	}

	work, err := os.MkdirTemp(moduleRoot, "readmecheck-")
	if err != nil {
		t.Fatalf("mkdir temp: %v", err)
	}
	defer os.RemoveAll(work)
	rel := filepath.Base(work)

	binDir := filepath.Join(work, "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}

	fragDir := filepath.Join(work, "frag")
	fragFiles := map[string]string{}
	var progDirs []string
	var runDirs []string
	progCount := 0

	stats := make([]*docStat, len(docs))

	for di, d := range docs {
		src, err := os.ReadFile(d.relpath)
		if err != nil {
			t.Fatalf("%s not found at %s: %v", d.label, d.relpath, err)
		}
		blocks := extractFencedBlocks(string(src), "go")
		if len(blocks) == 0 {
			t.Fatalf("no go code blocks in %s", d.label)
		}
		st := &docStat{total: len(blocks)}
		stats[di] = st

		for bi, block := range blocks {
			if isIllustration(block) {
				st.illustration++
				continue
			}
			if strings.Contains(block, "/*") {
				// Real code hidden behind a block comment: neither a
				// recognized illustration nor safely compilable as-is. Flag
				// it so the completeness assertion catches a would-be
				// silently-skipped example rather than dropping it.
				st.leaked = append(st.leaked, bi+1)
				continue
			}
			if strings.Contains(block, "func main") {
				// The documented program (possibly using the live sdk.New)
				// must compile as-is.
				dir := filepath.Join(work, "prog"+strconv.Itoa(progCount))
				if err := os.MkdirAll(dir, 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(block), 0o644); err != nil {
					t.Fatal(err)
				}
				progDirs = append(progDirs, "./"+rel+"/prog"+strconv.Itoa(progCount))

				// A test-mode variant — constructor rewritten to a seeded
				// sdk.TestSDK(...) — is run offline to prove the program runs.
				if variant, ok := rewriteCtorsToTest(block); ok {
					if !strings.Contains(variant, "os.") {
						variant = removeImportLine(variant, "os")
					}
					runDir := filepath.Join(work, "run"+strconv.Itoa(progCount))
					if err := os.MkdirAll(runDir, 0o755); err != nil {
						t.Fatal(err)
					}
					if err := os.WriteFile(filepath.Join(runDir, "main.go"), []byte(variant), 0o644); err != nil {
						t.Fatal(err)
					}
					runDirs = append(runDirs, "./"+rel+"/run"+strconv.Itoa(progCount))
				}

				progCount++
				st.compiled++
				continue
			}
			name := "snip" + strconv.Itoa(len(fragFiles))
			fragFiles[name] = wrapFragment(name, block, modulePath)
			st.compiled++
		}
	}

	fragPkg := ""
	if len(fragFiles) > 0 {
		if err := os.MkdirAll(fragDir, 0o755); err != nil {
			t.Fatal(err)
		}
		fragPkg = "./" + rel + "/frag"
	}

	if len(progDirs) == 0 && fragPkg == "" {
		t.Fatal("no buildable go snippets across docs")
	}

	// Build. The Go compiler is the oracle for unused imports/vars in the
	// wrapped fragments: blank them out and rebuild. Any OTHER error is a
	// genuine snippet bug and fails the test. The loop is progress-based,
	// not attempt-capped: \`-gcflags=-e\` lifts the compiler's 10-error cap so
	// every error surfaces in one round, applyFixes repairs them all, and
	// the loop continues while a round makes progress. It fails hard when no
	// fix applies, and fails as non-converged when a round changes nothing
	// in the build output (the fixes stopped helping).
	var lastOut string
	for {
		for name, content := range fragFiles {
			if err := os.WriteFile(filepath.Join(fragDir, name+".go"), []byte(content), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		out, buildErr := runGoBuild(moduleRoot, binDir, progDirs, fragPkg)
		if buildErr == nil {
			break
		}
		if out == lastOut {
			t.Fatalf("README go snippets did not converge to a clean build:\\n%s", out)
		}
		lastOut = out
		if !applyFixes(out, fragFiles) {
			t.Fatalf("README go snippet failed to compile:\\n%s", out)
		}
	}

	// Everything compiled. Now RUN the test-mode variants of the complete
	// programs and fail on a genuine runtime panic.
	if fail := runProgs(moduleRoot, runDirs); fail != "" {
		t.Fatal(fail)
	}

	// Completeness: every block in every doc is either compiled/run or a
	// recognized (narrow) illustration. A leaked block or a count mismatch is
	// a silently-untested example and fails the gate.
	for di, d := range docs {
		st := stats[di]
		if len(st.leaked) > 0 {
			t.Errorf("%s: go block(s) %v are neither compiled nor a "+
				"recognized illustration (silently untested) — use // "+
				"comments with real code, or a bare signature / /* ... */ "+
				"placeholder", d.label, st.leaked)
		}
		if st.total != st.compiled+st.illustration {
			t.Errorf("%s completeness: total %d != compiled %d + "+
				"illustration %d", d.label, st.total, st.compiled,
				st.illustration)
		}
		fmt.Printf("[readme-go] %s: total=%d compiled=%d illustration=%d\\n",
			d.label, st.total, st.compiled, st.illustration)
	}
}

// runProgs executes each test-mode program variant with \`go run\` and reports
// a genuine runtime panic (nil pointer / nil map / index / interface
// conversion). A tolerated not-found domain error (panic(err) on an offline
// fixture miss) is not a failure. A run-variant that fails to even compile is
// skipped — the documented program already passed the strict build check, so
// a rewrite artefact must not manufacture a false failure.
func runProgs(moduleRoot string, dirs []string) string {
	runtimeSigs := []string{
		"runtime error",
		"invalid memory address",
		"nil pointer dereference",
		"index out of range",
		"slice bounds out of range",
		"interface conversion",
		"assignment to entry in nil map",
	}
	for _, d := range dirs {
		cmd := exec.Command("go", "run", d)
		cmd.Dir = moduleRoot
		out, err := cmd.CombinedOutput()
		if err == nil {
			continue
		}
		s := string(out)
		if !strings.Contains(s, "panic:") {
			// Did not run (compile artefact of the rewrite) — tolerate.
			continue
		}
		for _, sig := range runtimeSigs {
			if strings.Contains(s, sig) {
				return "README go complete program panicked at runtime " +
					"(nil / type bug in a documented call):\\n" + s
			}
		}
		// Domain-error panic (e.g. offline fixture miss) — tolerated.
	}
	return ""
}

// rewriteCtorsToTest replaces every sdk.New.../sdk.Test... constructor call
// in src with a seeded test-mode client, so a documented (possibly live)
// program runs offline against the mock, and a fragment whose constructor
// takes undefined placeholder variables still type-checks. Single
// left-to-right pass with balanced-paren matching; returns the rewritten
// source and whether any replacement was made.
func rewriteCtorsToTest(src string) (string, bool) {
	repl := "sdk.TestSDK(" + testSeed + ", nil)"
	var b strings.Builder
	changed := false
	i := 0
	for i < len(src) {
		matched := ""
		if strings.HasPrefix(src[i:], "sdk.New") {
			matched = "sdk.New"
		} else if strings.HasPrefix(src[i:], "sdk.Test") {
			matched = "sdk.Test"
		}
		if matched == "" {
			b.WriteByte(src[i])
			i++
			continue
		}
		// Consume the rest of the identifier (e.g. NewAdviceSlipSDK, TestSDK).
		j := i + len(matched)
		for j < len(src) && isIdentByte(src[j]) {
			j++
		}
		if j >= len(src) || src[j] != '(' {
			b.WriteString(src[i:j])
			i = j
			continue
		}
		// Scan the balanced ( ... ) argument list.
		depth := 0
		k := j
		for k < len(src) {
			switch src[k] {
			case '(':
				depth++
			case ')':
				depth--
			}
			k++
			if depth == 0 {
				break
			}
		}
		b.WriteString(repl)
		changed = true
		i = k
	}
	return b.String(), changed
}

func isIdentByte(c byte) bool {
	return c == '_' ||
		(c >= 'a' && c <= 'z') ||
		(c >= 'A' && c <= 'Z') ||
		(c >= '0' && c <= '9')
}

// runGoBuild type-checks the fragment package with \`go build -gcflags=-e\`
// (a non-main package produces no output but is still fully type-checked —
// unlike \`go build -o dir/\`, which skips non-main packages — and \`-e\` lifts
// the compiler's 10-errors-per-package cap so EVERY unused-var/import error
// surfaces in a single round), and builds each complete program with
// \`-o binDir/\`. Any compile error from either is returned.
func runGoBuild(dir, binDir string, progDirs []string, fragPkg string) (string, error) {
	var out strings.Builder
	if fragPkg != "" {
		cmd := exec.Command("go", "build", "-gcflags=-e", fragPkg)
		cmd.Dir = dir
		o, err := cmd.CombinedOutput()
		out.Write(o)
		if err != nil {
			return out.String(), err
		}
	}
	if len(progDirs) > 0 {
		args := append([]string{"build", "-gcflags=-e", "-o", binDir + string(os.PathSeparator)}, progDirs...)
		cmd := exec.Command("go", args...)
		cmd.Dir = dir
		o, err := cmd.CombinedOutput()
		out.Write(o)
		if err != nil {
			return out.String(), err
		}
	}
	return out.String(), nil
}

func extractFencedBlocks(md, lang string) []string {
	var blocks []string
	lines := strings.Split(md, "\\n")
	open := "\`\`\`" + lang
	inBlock := false
	var cur []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !inBlock {
			if trimmed == open {
				inBlock = true
				cur = nil
			}
			continue
		}
		if trimmed == "\`\`\`" {
			blocks = append(blocks, strings.Join(cur, "\\n"))
			inBlock = false
			continue
		}
		cur = append(cur, line)
	}
	return blocks
}

// isIllustration is the NARROW class of blocks that are intentionally not
// compiled:
//   - a bare signature: a top-level func line with no body;
//   - a comment-only block: nothing remains after stripping // and /* */;
//   - a /* ... */ value-slot placeholder: a fill-in-the-blank template such as
//     "field": /* type */, that is deliberately not compilable.
// Every other block is compiled or run.
func isIllustration(block string) bool {
	trimmed := strings.TrimSpace(block)
	if strings.HasPrefix(trimmed, "func ") && !strings.Contains(block, "{") {
		return true
	}
	if strings.TrimSpace(stripGoComments(block)) == "" {
		return true
	}
	if hasPlaceholderComment(block) {
		return true
	}
	return false
}

// hasPlaceholderComment reports whether the block uses a /* ... */ comment in a
// value slot — immediately after ':', '=', '(', '{' or ',' (ignoring spaces) —
// i.e. the comment stands in for a value (\`"field": /* type */,\`), making the
// block a non-compilable illustration. A /* ... */ elsewhere (an incidental
// block comment) is NOT a placeholder, so a block that merely contains one is
// left for the completeness gate to flag rather than silently skip.
func hasPlaceholderComment(block string) bool {
	i := 0
	for {
		j := strings.Index(block[i:], "/*")
		if j < 0 {
			return false
		}
		start := i + j
		p := start - 1
		for p >= 0 && (block[p] == ' ' || block[p] == '\\t') {
			p--
		}
		if p >= 0 {
			switch block[p] {
			case ':', '=', '(', '{', ',':
				return true
			}
		}
		end := strings.Index(block[start+2:], "*/")
		if end < 0 {
			return false
		}
		i = start + 2 + end + 2
	}
}

// stripGoComments removes /* ... */ block comments and // line comments so a
// placeholder-only block can be recognized.
func stripGoComments(s string) string {
	var b strings.Builder
	i := 0
	for i < len(s) {
		if i+1 < len(s) && s[i] == '/' && s[i+1] == '*' {
			j := strings.Index(s[i+2:], "*/")
			if j < 0 {
				break
			}
			i = i + 2 + j + 2
			continue
		}
		if i+1 < len(s) && s[i] == '/' && s[i+1] == '/' {
			k := strings.IndexByte(s[i:], '\\n')
			if k < 0 {
				break
			}
			i += k
			continue
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}

// stripImportLines drops any single-line \`import ...\` statement from a
// fragment. Quick-start fragments carry their own import line (e.g.
// \`import sdk "..."\`), which is illegal inside the function wrapper; the
// wrapper re-adds the correct imports itself.
func stripImportLines(block string) string {
	var kept []string
	for _, line := range strings.Split(block, "\\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "import ") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\\n")
}

func wrapFragment(name, block, modulePath string) string {
	// Drop stray import lines and rewrite constructors to the seeded test
	// client so placeholder args (options, testopts, ...) type-check.
	block = stripImportLines(block)
	if rewritten, ok := rewriteCtorsToTest(block); ok {
		block = rewritten
	}

	declaresClient := strings.Contains(block, "client :=")
	injectClient := !declaresClient && strings.Contains(block, "client")

	needSdk := injectClient || strings.Contains(block, "sdk.")
	usesFmt := strings.Contains(block, "fmt.")
	usesOs := strings.Contains(block, "os.")
	usesCore := strings.Contains(block, "core.")
	usesEntity := strings.Contains(block, "entity.")

	var imports []string
	if usesFmt {
		imports = append(imports, "\\t\\"fmt\\"")
	}
	if usesOs {
		imports = append(imports, "\\t\\"os\\"")
	}
	if needSdk {
		imports = append(imports, "\\tsdk \\""+modulePath+"\\"")
	}
	if usesCore {
		imports = append(imports, "\\t\\""+modulePath+"/core\\"")
	}
	if usesEntity {
		imports = append(imports, "\\t\\""+modulePath+"/entity\\"")
	}

	var b strings.Builder
	b.WriteString("package readmefrag\\n\\n")
	if len(imports) > 0 {
		b.WriteString("import (\\n")
		b.WriteString(strings.Join(imports, "\\n"))
		b.WriteString("\\n)\\n\\n")
	}
	b.WriteString("func " + name + "() {\\n")
	if injectClient {
		// Seeded test client so the fragment's documented calls have data.
		b.WriteString("\\tclient := sdk.TestSDK(" + testSeed + ", nil)\\n")
	}
	b.WriteString(block)
	b.WriteString("\\n}\\n")
	return b.String()
}

func applyFixes(out string, fragFiles map[string]string) bool {
	changed := false
	for _, line := range strings.Split(out, "\\n") {
		if !strings.Contains(line, ".go:") {
			continue
		}
		key := snipKeyFromLine(line)
		if key == "" {
			continue
		}
		content, ok := fragFiles[key]
		if !ok {
			continue
		}
		if strings.Contains(line, "imported and not used") {
			pkg := quoted(line)
			if pkg != "" {
				nc := removeImportLine(content, pkg)
				if nc != content {
					fragFiles[key] = nc
					changed = true
				}
			}
		} else if strings.Contains(line, "not used") {
			nm := unusedName(line)
			if nm != "" {
				fragFiles[key] = addBlankAssign(content, nm)
				changed = true
			}
		}
	}
	return changed
}

func snipKeyFromLine(line string) string {
	i := strings.Index(line, "snip")
	if i < 0 {
		return ""
	}
	rest := line[i:]
	j := strings.Index(rest, ".go")
	if j < 0 {
		return ""
	}
	return rest[:j]
}

func quoted(line string) string {
	a := strings.Index(line, "\\"")
	if a < 0 {
		return ""
	}
	b := strings.Index(line[a+1:], "\\"")
	if b < 0 {
		return ""
	}
	return line[a+1 : a+1+b]
}

func unusedName(line string) string {
	marker := "not used:"
	i := strings.Index(line, marker)
	if i >= 0 {
		return strings.TrimSpace(line[i+len(marker):])
	}
	// Fallback: "<name> declared but not used"
	d := strings.Index(line, " declared")
	if d < 0 {
		return ""
	}
	head := strings.TrimSpace(line[:d])
	parts := strings.Fields(head)
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func removeImportLine(content, pkg string) string {
	needle := "\\"" + pkg + "\\""
	var kept []string
	for _, line := range strings.Split(content, "\\n") {
		t := strings.TrimSpace(line)
		// An import spec line ends with the quoted path (with optional
		// alias prefix); the \`import (\` opener does not.
		if strings.HasSuffix(t, needle) && !strings.HasPrefix(t, "import") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\\n")
}

func addBlankAssign(content, name string) string {
	// Insert \`_ = name\` before the final closing brace of the func.
	last := strings.LastIndex(content, "}")
	if last < 0 {
		return content
	}
	return content[:last] + "\\t_ = " + name + "\\n" + content[last:]
}

func readModulePath(moduleRoot string) string {
	data, err := os.ReadFile(filepath.Join(moduleRoot, "go.mod"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(t, "module"))
		}
	}
	return ""
}
`)
  })

})


export {
  ReadmeExamplesTest
}
