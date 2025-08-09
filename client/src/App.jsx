import React, { useState } from "react";
import { toast, Toaster } from "sonner";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { getFiles, getSummaries, generateTest } from "./api"; // adjust path if needed
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function App() {
  // repo inputs
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");

  // data
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [testCode, setTestCode] = useState("");

  // loading states
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [loadingTests, setLoadingTests] = useState({}); // keyed by cleaned summary
  const [loadingPR, setLoadingPR] = useState(false);




function detectLanguage(code) {
  // Remove leading/trailing whitespace and markdown code block markers
  const trimmedCode = code.replace(/^```.*\n?/, '').replace(/```$/, '').trim();
  
  // TypeScript/TSX (look for TS-specific syntax)
  if (/^\s*(import|export|declare|interface|type)\s+.+\s+from\s+['"]|`/.test(trimmedCode) || 
      trimmedCode.includes(': string') || 
      trimmedCode.includes(': number') ||
      trimmedCode.includes('interface ') ||
      trimmedCode.includes('type ')) {
    return trimmedCode.includes('</') ? 'tsx' : 'typescript';
  }

  // JSX/TSX (look for HTML tags)
  if (/<[A-Za-z][^>]*\/?>/.test(trimmedCode)) {
    return trimmedCode.includes(':') ? 'tsx' : 'jsx';
  }

  // Python
  if (/^\s*(def |class |import |from |print\(|#)/m.test(trimmedCode)) {
    return 'python';
  }

  // Java
  if (/^\s*package\s+|public\s+class|@Override|import\s+java\./.test(trimmedCode)) {
    return 'java';
  }

  // C#
  if (/^\s*using\s+|namespace\s+|public\s+class|\[.*\]\s*public/.test(trimmedCode)) {
    return 'csharp';
  }

  // C/C++
  if (/^\s*#include\s+|using\s+namespace|std::|int\s+main\(/.test(trimmedCode)) {
    return trimmedCode.includes('cout') || trimmedCode.includes('std::') ? 'cpp' : 'c';
  }

  // Ruby
  if (/^\s*def\s+|class\s+|require\s+|puts\s+/.test(trimmedCode)) {
    return 'ruby';
  }

  // PHP
  if (/^\s*<\?php|echo\s+|function\s+|use\s+.+\\/.test(trimmedCode)) {
    return 'php';
  }

  // Go
  if (/^\s*package\s+|import\s+\(|func\s+main\(|fmt\.Print/.test(trimmedCode)) {
    return 'go';
  }

  // Rust
  if (/^\s*fn\s+main\(|println!|use\s+.+::|let\s+mut\s+/.test(trimmedCode)) {
    return 'rust';
  }

  // Kotlin
  if (/^\s*package\s+|fun\s+main\(|import\s+.+|class\s+/.test(trimmedCode)) {
    return 'kotlin';
  }

  // Swift
  if (/^\s*import\s+Swift|func\s+|let\s+|var\s+|struct\s+/.test(trimmedCode)) {
    return 'swift';
  }

  // Default to JavaScript if no other matches
  return 'javascript';
}
// Clean AI markdown-style formatting
function cleanTestCode(text) {
  return text
    // Remove markdown headers but keep their text
    .replace(/^#+\s*(.*?)\s*$/gm, '$1')
    // Remove markdown bullet points but keep the text
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove bold/italic markdown but keep the text
    .replace(/(\*\*|\*|__|_)(.*?)\1/g, '$2')
    // Remove code blocks markers but keep the content
    .replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1')
    // Normalize multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}
  // helper spinner (small)
  const Spinner = ({ className = "h-4 w-4 mr-2" }) => (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );

  // sanitize/clean summaries before display/use
  const cleanSummary = (text) => {
    if (!text) return "";
    // remove //, **, * and trim; keep other punctuation
    return text.replace(/\/\/+/g, "").replace(/\*+/g, "").trim();
  };

  // fetch files (handles both res.data.files and res.data formats)
  const fetchFiles = async () => {
    const ownerTrim = owner.trim();
    const repoTrim = repo.trim();
    if (!ownerTrim || !repoTrim) {
      toast.error("Enter owner and repo");
      return;
    }

    setLoadingFiles(true);
    try {
      const res = await getFiles(ownerTrim, repoTrim);
      // support both shapes: { count, files } or array
      const filesFromResp = res?.data?.files ?? res?.data ?? [];
      setFiles(Array.isArray(filesFromResp) ? filesFromResp : []);
      setSelectedFiles([]); // reset
      toast.success("Files fetched successfully!", {
        icon: <CheckCircle size={18} />,
      });
    } catch (err) {
      console.error("fetchFiles error:", err);
      toast.error(`Error fetching files: ${err?.message ?? ""}`, {
        icon: <AlertTriangle size={18} />,
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  // generate summaries from selected files
  const fetchSummaries = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Select at least one file.");
      return;
    }

    setLoadingSummaries(true);
    try {
      const res = await getSummaries({ owner: owner.trim(), repo: repo.trim(), files: selectedFiles });
      // accept either string or array
      const raw = res?.data?.summaries ?? res?.data ?? "";
      let arr = [];
      if (Array.isArray(raw)) arr = raw;
      else if (typeof raw === "string") arr = raw.split("\n");
      else if (typeof raw === "object" && raw !== null) arr = raw; // fallback

      const cleaned = arr.map((s) => cleanSummary(s)).filter((s) => s && s.length > 0);
      setSummaries(cleaned);
      toast.success("Summaries generated successfully!", {
        icon: <CheckCircle size={18} />,
      });
    } catch (err) {
      console.error("fetchSummaries error:", err);
      toast.error(`Error generating summaries: ${err?.message ?? ""}`, {
        icon: <AlertTriangle size={18} />,
      });
    } finally {
      setLoadingSummaries(false);
    }
  };

  // generate test code for a single summary; per-summary loading tracked
  const fetchTestCode = async (rawSummary) => {
    const summary = cleanSummary(rawSummary);
    if (!summary) {
      toast.error("Invalid summary");
      return;
    }

    // use summary as key (safe because we cleaned it)
    setLoadingTests((prev) => ({ ...prev, [summary]: true }));
    try {
      const res = await generateTest({ summary, framework: "Jest", files: selectedFiles });
      const code = res?.data?.code ?? res?.data ?? "";
      setSelectedSummary(summary);
      setTestCode(code);
      toast.success("Test code generated!", {
        icon: <CheckCircle size={18} />,
      });
    } catch (err) {
      console.error("fetchTestCode error:", err);
      toast.error(`Error generating test code: ${err?.message ?? ""}`, {
        icon: <AlertTriangle size={18} />,
      });
    } finally {
      setLoadingTests((prev) => ({ ...prev, [summary]: false }));
    }
  };

  // copy test code to clipboard
  const copyTestCode = async () => {
    if (!testCode) return;
    try {
      await navigator.clipboard.writeText(testCode);
      toast.success("Copied test code to clipboard", { icon: <CheckCircle size={18} /> });
    } catch (err) {
      toast.error("Copy failed", { icon: <AlertTriangle size={18} /> });
    }
  };

  // create PR for generated test code (calls backend /create-pr)
  const createPR = async () => {
    if (!testCode) {
      toast.error("No test code to create PR");
      return;
    }
    const ownerTrim = owner.trim();
    const repoTrim = repo.trim();
    if (!ownerTrim || !repoTrim) {
      toast.error("Enter owner and repo");
      return;
    }

    setLoadingPR(true);
    try {
      const branchName = `add-ai-test-${Date.now()}`;
      const filePath = `tests/generated-test-${Date.now()}.test.js`;
      // change base url if your backend runs on different port
      const API_BASE = "http://localhost:5100";
      const res = await fetch(`${API_BASE}/create-pr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: ownerTrim,
          repo: repoTrim,
          branchName,
          filePath,
          fileContent: testCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.prUrl) {
        toast.success("Pull Request created!", { icon: <CheckCircle size={18} /> });
        window.open(data.prUrl, "_blank");
      } else {
        console.error("createPR error payload:", data);
        toast.error(`PR creation failed: ${data?.error ?? "unknown"}`, { icon: <AlertTriangle size={18} /> });
      }
    } catch (err) {
      console.error("createPR exception:", err);
      toast.error(`PR creation failed: ${err?.message ?? ""}`, { icon: <AlertTriangle size={18} /> });
    } finally {
      setLoadingPR(false);
    }
  };

  // toggle file selection by path
  const toggleFileSelection = (file) => {
    setSelectedFiles((prev) => {
      const exists = prev.some((f) => f.path === file.path);
      if (exists) return prev.filter((f) => f.path !== file.path);
      return [...prev, file];
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      {/* Toaster for feedback */}
      <Toaster richColors position="top-right" />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Heading */}
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-1">
            🧪 AI-Powered Test Case Generator
          </h1>
          <p className="text-gray-500 text-sm">
            Enter a repository, pick files (or a folder), generate test summaries and produce test code automatically.
          </p>
        </header>

        {/* Repo Input */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <input
              placeholder="GitHub Owner (e.g. facebook)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              placeholder="Repository Name (e.g. react)"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={fetchFiles}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2 rounded-xl shadow hover:shadow-md transition flex items-center gap-2"
            >
              {loadingFiles ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Loading...
                </>
              ) : (
                "Fetch Files"
              )}
            </button>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-lg">Select Files</h2>
            <div className="border border-gray-100 rounded-xl p-3 space-y-2 max-h-52 overflow-auto">
              {files.map((f) => (
                <label
                  key={f.path}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.some((sf) => sf.path === f.path)}
                    className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                    onChange={() => toggleFileSelection(f)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-gray-400">{f.path}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchSummaries}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-xl shadow hover:shadow-md transition flex items-center gap-2"
              >
                {loadingSummaries ? (
                  <>
                    <Spinner className="h-4 w-4" /> Generating Summaries...
                  </>
                ) : (
                  "Generate Summaries"
                )}
              </button>

              <div className="text-sm text-gray-500">
                {selectedFiles.length} file(s) selected
              </div>
            </div>
          </div>
        )}

        {/* Summaries */}
        {summaries.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <span>📄</span> Summaries
            </h2>

            <div className="space-y-3">
{summaries.map((raw, idx) => {
  const s = cleanSummary(raw);
  const isComment = s.startsWith("//") || s.startsWith("#");
  const isLoading = !!loadingTests[s];

  return (
    <div
      key={idx}
      className="flex flex-col md:flex-row justify-between gap-3 p-3 border border-gray-100 rounded-xl hover:shadow-md transition bg-white"
    >
      {/* Fixed height code area */}
      <div className="flex-1 min-h-[80px] max-h-[200px] overflow-hidden">
        <div className="h-full overflow-y-auto">
          <pre
            className={`text-sm font-mono whitespace-pre-wrap leading-relaxed p-2 rounded ${
              isComment ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-800"
            }`}
          >
            {s}
          </pre>
        </div>
      </div>

      {/* Button - unchanged */}
      <button
        onClick={() => fetchTestCode(s)}
        className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-transform duration-200 min-w-[150px] flex items-center justify-center self-center"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </>
        ) : (
          "⚡ Generate Test"
        )}
      </button>
    </div>
  );
})}
            </div>
          </div>
        )}

        {/* Generated Test Code + Actions */}
        {testCode && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Generated Test Code</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyTestCode}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Copy
                </button>
                <button
                  onClick={createPR}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1.5 rounded-lg shadow hover:shadow-md transition flex items-center gap-2"
                  disabled={loadingPR}
                >
                  {loadingPR ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Creating PR...
                    </>
                  ) : (
                    "Create Pull Request"
                  )}
                </button>
              </div>
            </div>

{testCode && (
  <div className="mt-4">
    <SyntaxHighlighter
      language={detectLanguage(testCode)}
      style={vscDarkPlus}
      showLineNumbers
      wrapLines
      customStyle={{
        borderRadius: "0.75rem",
        padding: "1rem",
        fontSize: "0.9rem",
        background: "#1e1e1e",
      }}
    >
      {cleanTestCode(testCode)}
    </SyntaxHighlighter>
  </div>
)}
          </div>
        )}
      </div>
    </div>
  );
}
