import axios from "axios";
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
});
export const message = (error) =>
  error.response?.data?.message ||
  (error.name === "AttachmentError" ? error.message : null) ||
  (error.code === "ECONNABORTED"
    ? "The request took too long. Please try again."
    : "Unable to connect. Check your connection and try again.");
api.interceptors.request.use((config) => {
  if (
    config.data instanceof FormData &&
    config.data.get("file")?.size > MAX_ATTACHMENT_BYTES
  ) {
    const error = new Error("Maximum file size is 3 MB.");
    error.name = "AttachmentError";
    throw error;
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !/\/auth\/(login|register|me)/.test(error.config?.url || "")
    )
      window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(error);
  },
);
export async function downloadFile(file) {
  const response = await api.get(`/files/${file.id}`, {
    responseType: "blob",
    timeout: 120000,
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
