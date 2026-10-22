const express = require("express");
const { Storage } = require("@google-cloud/storage");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 8081;
const BUCKET_NAME = process.env.BUCKET_NAME;
const UPLOAD_API_TOKEN = process.env.UPLOAD_API_TOKEN;

if (!BUCKET_NAME || !UPLOAD_API_TOKEN) {
  throw new Error("Set BUCKET_NAME and UPLOAD_API_TOKEN");
}

// Uses the VM's attached uploader service account via Application Default Credentials.
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

app.use(express.json({ limit: "10kb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "microservice-2-uploader" });
});

app.post("/upload", async (req, res) => {
  const suppliedToken = req.get("X-Upload-Token");
  if (suppliedToken !== UPLOAD_API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, message } = req.body || {};
  if (
    typeof name !== "string" ||
    typeof message !== "string" ||
    !name.trim() ||
    !message.trim() ||
    name.length > 100 ||
    message.length > 2000
  ) {
    return res.status(400).json({ error: "A valid name and message are required." });
  }

  const objectName = `submissions/${randomUUID()}.json`;
  const data = {
    name: name.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  try {
    await bucket.file(objectName).save(JSON.stringify(data, null, 2), {
      resumable: false,
      contentType: "application/json",
      metadata: { cacheControl: "no-store" },
      preconditionOpts: { ifGenerationMatch: 0 }
    });

    console.log("Created object:", objectName);
    res.status(201).json({ success: true, file: objectName });
  } catch (error) {
    console.error("Cloud Storage upload failed:", error.message);
    res.status(500).json({ error: "Could not save the object. Check bucket IAM permissions." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Upload microservice running on port ${PORT}`);
});
