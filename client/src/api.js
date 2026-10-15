import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
});
export const message = (error) =>
  error.response?.data?.message ||
  (error.code === "ECONNABORTED"
    ? "The request took too long. Please try again."
    : "Unable to connect. Check your connection and try again.");
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
