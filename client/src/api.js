import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:5100" });

export const getFiles = (owner, repo) =>
  API.get("/files", { params: { owner, repo } });

export const getSummaries = (payload) =>
  API.post("/summaries", payload);

export const generateTest = (payload) =>
  API.post("/generate-test", payload);
