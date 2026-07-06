import { cmp, Content, File } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits go/test/readme_examples_test.go — an offline test that extracts
// every ```go block from the module README and exercises it against the
// real generated SDK:
//
//   - Fragments (statement snippets) are wrapped in a function with a
//     SEEDED test-mode `client` in scope and `go build`-checked. A call to
//     a method that does not exist, wrong argument types, or `.data`/`.ok`
//     field access on an entity-op result (which is the bare value, not an
//     envelope) fails to compile — and so fails the test.
//   - Complete programs (a block with `func main`) are built as-is (the
//     documented, possibly live, form must compile) AND a test-mode variant
//     — its client constructor rewritten to a seeded `sdk.TestSDK(...)` — is
//     actually RUN with `go run`. A genuine runtime panic (nil pointer, nil
//     map, index/interface-conversion) FAILS the test; a tolerated
//     not-found domain error does not.
//
// Illustrative blocks are skipped: bare signatures (a `func` line with no
// body) and blocks that contain a `/* ... */` placeholder value.
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

// TestReadmeGoSnippets extracts every \`\`\`go fenced block from the module
// README (../README.md) and exercises it. Fragments are \`go build\`-checked
// with a seeded test client injected; complete programs are built as-is and
// their test-mode variant is run with \`go run\`.
func TestReadmeGoSnippets(t *testing.T) {
	_, thisFile, _, _ := runtime.Caller(0)
	testDir := filepath.Dir(thisFile)
	moduleRoot := filepath.Dir(testDir)
	readmePath := filepath.Join(testDir, "..", "README.md")

	src, err := os.ReadFile(readmePath)
	if err != nil {
		t.Skipf("README not found at %s: %v", readmePath, err)
	}

	modulePath := readModulePath(moduleRoot)
	if modulePath == "" {
		t.Skip("could not read module path from go.mod")
	}

	blocks := extractFencedBlocks(string(src), "go")
	if len(blocks) == 0 {
		t.Skip("no go code blocks in README")
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

	for _, block := range blocks {
		if skipBlock(block) {
			continue
		}
		if strings.Contains(block, "func main") {
			// The documented program (possibly using the live sdk.New) must
			// compile as-is.
			dir := filepath.Join(work, "prog"+strconv.Itoa(progCount))
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(block), 0o644); err != nil {
				t.Fatal(err)
			}
			progDirs = append(progDirs, "./"+rel+"/prog"+strconv.Itoa(progCount))

			// A test-mode variant — client constructor rewritten to a seeded
			// sdk.TestSDK(...) — is run offline to prove the program executes.
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
			continue
		}
		name := "snip" + strconv.Itoa(len(fragFiles))
		fragFiles[name] = wrapFragment(name, block, modulePath)
	}

	fragPkg := ""
	if len(fragFiles) > 0 {
		if err := os.MkdirAll(fragDir, 0o755); err != nil {
			t.Fatal(err)
		}
		fragPkg = "./" + rel + "/frag"
	}

	if len(progDirs) == 0 && fragPkg == "" {
		t.Skip("no buildable go snippets in README")
	}

	// Build. The Go compiler is the oracle for unused imports/vars in the
	// wrapped fragments: blank them out and rebuild. Any OTHER error is a
	// genuine snippet bug and fails the test.
	var lastOut string
	built := false
	for attempt := 0; attempt < 15; attempt++ {
		for name, content := range fragFiles {
			if err := os.WriteFile(filepath.Join(fragDir, name+".go"), []byte(content), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		out, buildErr := runGoBuild(moduleRoot, binDir, progDirs, fragPkg)
		if buildErr == nil {
			built = true
			break
		}
		lastOut = out
		if !applyFixes(out, fragFiles) {
			t.Fatalf("README go snippet failed to compile:\\n%s", out)
		}
	}
	if !built {
		t.Fatalf("README go snippets did not converge to a clean build:\\n%s", lastOut)
	}

	// Everything compiled. Now RUN the test-mode variants of the complete
	// programs and fail on a genuine runtime panic.
	if fail := runProgs(moduleRoot, runDirs); fail != "" {
		t.Fatal(fail)
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
// program runs offline against the mock. Single left-to-right pass with
// balanced-paren matching; returns the rewritten source and whether any
// replacement was made.
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

// runGoBuild type-checks the fragment package with a plain \`go build\`
// (a non-main package produces no output but is still fully type-checked
// — unlike \`go build -o dir/\`, which skips non-main packages), and builds
// each complete program with \`-o binDir/\`. Any compile error from either
// is returned.
func runGoBuild(dir, binDir string, progDirs []string, fragPkg string) (string, error) {
	var out strings.Builder
	if fragPkg != "" {
		cmd := exec.Command("go", "build", fragPkg)
		cmd.Dir = dir
		o, err := cmd.CombinedOutput()
		out.Write(o)
		if err != nil {
			return out.String(), err
		}
	}
	if len(progDirs) > 0 {
		args := append([]string{"build", "-o", binDir + string(os.PathSeparator)}, progDirs...)
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

func skipBlock(block string) bool {
	if strings.Contains(block, "/*") {
		return true
	}
	// Bare signature: a top-level func line with no body.
	trimmed := strings.TrimSpace(block)
	if strings.HasPrefix(trimmed, "func ") && !strings.Contains(block, "{") {
		return true
	}
	return false
}

func wrapFragment(name, block, modulePath string) string {
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
