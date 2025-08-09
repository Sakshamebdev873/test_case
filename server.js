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
    const { data } = await octokit.repos.getContent({ owner, repo, path });

    // Only return code files
    const codeFiles = data.filter(f => f.type === "file" && /\.(js|ts|py|java|jsx|tsx)$/.test(f.name));
    res.json(codeFiles);
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

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const aiRes = await model.generateContent(`Generate ${framework} test code for:\n${summary}`);
    res.json({ code: aiRes.response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Backend running on port ${process.env.PORT}`);
});
