export async function notify(title: string, message: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC ?? "news-bot";
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: { Title: title.slice(0, 100) },
      body: message.slice(0, 4000),
    });
  } catch (e) {
    console.error("ntfy failed:", e);
  }
}
