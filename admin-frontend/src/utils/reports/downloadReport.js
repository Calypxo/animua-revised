export function downloadReport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Leave time for the browser to consume the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
