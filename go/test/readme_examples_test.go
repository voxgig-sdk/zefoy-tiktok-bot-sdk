package sdktest

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// TestReadmeGoSnippets extracts every ```go fenced block from the module
// README (../README.md) and compiles them with `go build`. This is a
// static, offline check: it does not run any snippet, only proves the
// example code type-checks against the real generated SDK.
//
//   - Complete programs (a block containing `func main`) are built as-is.
//   - Statement fragments are wrapped in a function with a test-mode
//     `client` in scope, then built.
//
// A snippet that calls a method that does not exist, passes the wrong
// argument types, or accesses a field the value does not have — e.g.
// `.data` / `.ok` on an entity-op result, which is the bare data value,
// NOT a `{ok,data,...}` envelope (only Direct returns that) — fails to
// compile, and so fails this test.
//
// Illustrative blocks are skipped: bare signatures (a `func` line with no
// body) and blocks that contain a `/* ... */` placeholder value.
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
	progCount := 0

	for _, block := range blocks {
		if skipBlock(block) {
			continue
		}
		if strings.Contains(block, "func main") {
			dir := filepath.Join(work, "prog"+strconv.Itoa(progCount))
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(block), 0o644); err != nil {
				t.Fatal(err)
			}
			progDirs = append(progDirs, "./"+rel+"/prog"+strconv.Itoa(progCount))
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
	for attempt := 0; attempt < 15; attempt++ {
		for name, content := range fragFiles {
			if err := os.WriteFile(filepath.Join(fragDir, name+".go"), []byte(content), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		out, buildErr := runGoBuild(moduleRoot, binDir, progDirs, fragPkg)
		if buildErr == nil {
			return
		}
		lastOut = out
		if !applyFixes(out, fragFiles) {
			t.Fatalf("README go snippet failed to compile:\n%s", out)
		}
	}
	t.Fatalf("README go snippets did not converge to a clean build:\n%s", lastOut)
}

// runGoBuild type-checks the fragment package with a plain `go build`
// (a non-main package produces no output but is still fully type-checked
// — unlike `go build -o dir/`, which skips non-main packages), and builds
// each complete program with `-o binDir/`. Any compile error from either
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
	lines := strings.Split(md, "\n")
	open := "```" + lang
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
		if trimmed == "```" {
			blocks = append(blocks, strings.Join(cur, "\n"))
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
		imports = append(imports, "\t\"fmt\"")
	}
	if usesOs {
		imports = append(imports, "\t\"os\"")
	}
	if needSdk {
		imports = append(imports, "\tsdk \""+modulePath+"\"")
	}
	if usesCore {
		imports = append(imports, "\t\""+modulePath+"/core\"")
	}
	if usesEntity {
		imports = append(imports, "\t\""+modulePath+"/entity\"")
	}

	var b strings.Builder
	b.WriteString("package readmefrag\n\n")
	if len(imports) > 0 {
		b.WriteString("import (\n")
		b.WriteString(strings.Join(imports, "\n"))
		b.WriteString("\n)\n\n")
	}
	b.WriteString("func " + name + "() {\n")
	if injectClient {
		b.WriteString("\tclient := sdk.Test()\n")
	}
	b.WriteString(block)
	b.WriteString("\n}\n")
	return b.String()
}

func applyFixes(out string, fragFiles map[string]string) bool {
	changed := false
	for _, line := range strings.Split(out, "\n") {
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
	a := strings.Index(line, "\"")
	if a < 0 {
		return ""
	}
	b := strings.Index(line[a+1:], "\"")
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
	needle := "\"" + pkg + "\""
	var kept []string
	for _, line := range strings.Split(content, "\n") {
		t := strings.TrimSpace(line)
		// An import spec line ends with the quoted path (with optional
		// alias prefix); the `import (` opener does not.
		if strings.HasSuffix(t, needle) && !strings.HasPrefix(t, "import") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\n")
}

func addBlankAssign(content, name string) string {
	// Insert `_ = name` before the final closing brace of the func.
	last := strings.LastIndex(content, "}")
	if last < 0 {
		return content
	}
	return content[:last] + "\t_ = " + name + "\n" + content[last:]
}

func readModulePath(moduleRoot string) string {
	data, err := os.ReadFile(filepath.Join(moduleRoot, "go.mod"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		t := strings.TrimSpace(line)
		if strings.HasPrefix(t, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(t, "module"))
		}
	}
	return ""
}
