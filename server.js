import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize GitHub client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Initialize AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1️⃣ Get files from repo
app.get("/files", async (req, res) => {
  try {
    const { owner, repo, path = "" } = req.query;

    async function getAllFiles(owner, repo, folderPath) {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: folderPath
      });

      let files = [];

      for (const item of data) {
        if (item.type === "file" && /\.(js|ts|py|java|jsx|tsx)$/.test(item.name)) {
          files.push(item);
        } else if (item.type === "dir") {
          const subFiles = await getAllFiles(owner, repo, item.path);
          files = files.concat(subFiles);
        }
      }

      return files;
    }

    const allFiles = await getAllFiles(owner, repo, path);
    res.json(allFiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 2️⃣ Generate test case summaries
app.post("/summaries", async (req, res) => {
  try {
    const { files, owner, repo } = req.body;
    let contents = "";

    for (let f of files) {
      const { data } = await octokit.repos.getContent({ owner, repo, path: f.path });
      const fileContent = Buffer.from(data.content, "base64").toString();
      contents += `\n--- ${f.name} ---\n${fileContent}`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const aiRes = await model.generateContent(`Generate concise test case summaries for the following files:\n${contents}`);
    res.json({ summaries: aiRes.response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Generate full test code from a summary
app.post("/generate-test", async (req, res) => {
  try {
    const { summary, framework = "Jest" } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const aiRes = await model.generateContent(`Generate ${framework} test code for:\n${summary}`);
    res.json({ code: aiRes.response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/create-pr", async (req, res) => {
  try {
    const { owner, repo, branchName, filePath, fileContent } = req.body;

    // 1️⃣ Get default branch info
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // 2️⃣ Get latest commit SHA of default branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const latestCommitSha = refData.object.sha;

    // 3️⃣ Create a new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: latestCommitSha,
    });

    // 4️⃣ Add the test file to the branch
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Add generated test: ${filePath}`,
      content: Buffer.from(fileContent).toString("base64"),
      branch: branchName,
    });

    // 5️⃣ Create PR
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `Add generated test for ${filePath}`,
      head: branchName,
      base: defaultBranch,
      body: "This PR was automatically created by the AI Test Case Generator.",
    });

    res.json({ prUrl: pr.html_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Backend running on port ${process.env.PORT}`);
});


