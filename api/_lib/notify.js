export async function notify(title, message) {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return

  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: title },
      body: message,
    })
  } catch {
    // Notifications are best-effort — never let a failed push break a trade cycle.
  }
}
