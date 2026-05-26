export async function notify(title: string, message: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC ?? "news-bot";
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: { Title: title },
      body: message,
    });
  } catch (e) {
    console.error("ntfy notification failed:", e);
  }
}
