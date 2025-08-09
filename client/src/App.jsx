import { useState } from "react";
import { getFiles, getSummaries, generateTest } from "./api";

export default function App() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [testCode, setTestCode] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await getFiles(owner, repo);
      setFiles(res.data);
    } catch (err) {
      alert("Error fetching files");
    }
    setLoading(false);
  };

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const res = await getSummaries({ owner, repo, files: selectedFiles });
      // Split summaries if AI returns as a paragraph
      setSummaries(res.data.summaries.split("\n").filter(s => s.trim()));
    } catch (err) {
      alert("Error generating summaries");
    }
    setLoading(false);
  };

  const fetchTestCode = async (summary) => {
    setLoading(true);
    try {
      const res = await generateTest({ summary, framework: "Jest" });
      setSelectedSummary(summary);
      setTestCode(res.data.code);
    } catch (err) {
      alert("Error generating test code");
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Test Case Generator</h1>

      {/* Repo Input */}
      <div className="flex gap-2">
        <input
          placeholder="GitHub Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="border p-2 flex-1"
        />
        <input
          placeholder="Repository Name"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="border p-2 flex-1"
        />
        <button onClick={fetchFiles} className="bg-blue-500 text-white px-4 py-2 rounded">
          {loading ? "Loading..." : "Fetch Files"}
        </button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div>
          <h2 className="font-semibold">Select Files</h2>
          <div className="border p-2 space-y-1 max-h-40 overflow-auto">
            {files.map((f) => (
              <label key={f.path} className="block">
                <input
                  type="checkbox"
                  onChange={(e) =>
                    setSelectedFiles((prev) =>
                      e.target.checked
                        ? [...prev, f]
                        : prev.filter((file) => file.path !== f.path)
                    )
                  }
                />{" "}
                {f.name}
              </label>
            ))}
          </div>
          <button
            onClick={fetchSummaries}
            className="bg-green-500 text-white px-4 py-2 mt-2 rounded"
          >
            Generate Summaries
          </button>
        </div>
      )}

      {/* Summaries */}
      {summaries.length > 0 && (
        <div>
          <h2 className="font-semibold">Summaries</h2>
          <div className="space-y-2">
            {summaries.map((s, idx) => (
              <div key={idx} className="border p-2 rounded flex justify-between">
                <span>{s}</span>
                <button
                  onClick={() => fetchTestCode(s)}
                  className="bg-purple-500 text-white px-3 py-1 rounded"
                >
                  Generate Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Code */}
      {testCode && (
        <div>
          <h2 className="font-semibold">Generated Test Code</h2>
          <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">{testCode}</pre>
        </div>
      )}
    </div>
  );
}
