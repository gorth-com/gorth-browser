import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { rawInitializeDatabase, rawCloseDatabase } from "@/services/database"
import { rawLoadDownloads, rawSaveDownload, rawDeleteDownload } from "@/models/download"
import { rawLoadDownloadPreferences, rawSaveDownloadPreferences } from "@/models/setting"
import { rawLoadBrowserSnapshot, rawSaveBrowserSnapshot } from "@/models/tab"
import {
  getAvailableDownloadPath,
  getSafeDownloadName,
} from "@/main/services/download-path";
import type { DownloadRecord } from "@/lib/browser/downloads";

test("Download history survives session save/restart; unfinished items become interrupted", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-download-db-"));
  try {
    rawInitializeDatabase(directory);
    const record: DownloadRecord = {
      id: crypto.randomUUID(),
      filename: "file.txt",
      url: "https://example.com/file",
      savePath: path.join(directory, "file.txt"),
      mimeType: "text/plain",
      receivedBytes: 20,
      totalBytes: 100,
      state: "paused",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeFileSync(record.savePath, "keep this file");
    rawSaveDownload(record);
    const completed = {
      ...record,
      id: crypto.randomUUID(),
      state: "completed" as const,
    };
    rawSaveDownload(completed);
    rawSaveDownloadPreferences({ directory, askWhereToSave: false });
    rawSaveBrowserSnapshot(rawLoadBrowserSnapshot());
    assert.equal(rawLoadDownloads().length, 2);
    rawCloseDatabase();
    rawInitializeDatabase(directory);
    assert.equal(
      rawLoadDownloads().find((item) => item.id === record.id)?.state,
      "interrupted",
    );
    assert.equal(
      rawLoadDownloads().find((item) => item.id === completed.id)?.state,
      "completed",
    );
    assert.deepEqual(rawLoadDownloadPreferences("fallback"), {
      directory,
      askWhereToSave: false,
    });
    rawDeleteDownload(record.id);
    rawDeleteDownload(completed.id);
    assert.equal(rawLoadDownloads().length, 0);
    assert.ok(
      existsSync(record.savePath),
      "History removal must not delete the downloaded file",
    );
  } finally {
    rawCloseDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Download paths sanitize filenames and avoid existing, reserved and broken-symlink targets", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "gorth-download-path-"));
  try {
    assert.equal(getSafeDownloadName("../../outside.txt"), "outside.txt");
    assert.equal(getSafeDownloadName("C:\\outside\\file.txt"), "file.txt");
    assert.equal(getSafeDownloadName("NUL.txt"), "download-NUL.txt");
    assert.equal(getSafeDownloadName(".."), "download");
    assert.equal(getSafeDownloadName("bad\0name.txt"), "bad_name.txt");
    writeFileSync(path.join(directory, "file.txt"), "original");
    mkdirSync(path.join(directory, "file (1).txt"));
    const reserved = new Set([path.join(directory, "file (2).txt")]);
    assert.equal(
      getAvailableDownloadPath(directory, "file.txt", reserved),
      path.join(directory, "file (3).txt"),
    );
    if (process.platform !== "win32") {
      symlinkSync(
        path.join(directory, "missing"),
        path.join(directory, "link.txt"),
      );
      assert.equal(
        getAvailableDownloadPath(directory, "link.txt", new Set()),
        path.join(directory, "link (1).txt"),
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
