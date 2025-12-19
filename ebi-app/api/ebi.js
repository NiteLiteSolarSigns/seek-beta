export default function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }
  
    const { subject = "Unknown", subjectType = "person", notes = "" } = req.body || {};
  
    const seed = (subject + subjectType + notes).length;
    const clamp = (n) => Math.max(1, Math.min(10, n));
  
    const scores = {
      scope_of_impact: clamp((seed % 10) + 1),
      direction_of_tension: clamp(((seed + 3) % 10) + 1),
      longevity: clamp(((seed + 6) % 10) + 1),
      cost_paid: clamp(((seed + 1) % 10) + 1),
      bridge_function: clamp(((seed + 8) % 10) + 1),
    };
  
    const total_score = Object.values(scores).reduce((a, b) => a + b, 0);
  
    res.status(200).json({
      subject,
      subject_type: subjectType,
      scores,
      total_score,
      message: "EBI API is live on Vercel"
    });
  }