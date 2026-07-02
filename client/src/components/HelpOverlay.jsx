import React, {useState} from "react";
import {motion} from "framer-motion";
import {X, Loader2, Send, CheckCircle2} from "lucide-react";

const HelpOverlay = ({onClose, apiBaseUrl}) => {
  const [feedbackForm, setFeedbackForm] = useState({
    email: "",
    category: "Help & Support",
    message: ""
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackForm.email.trim() || !feedbackForm.message.trim()) return;

    setSubmittingFeedback(true);
    setFormError("");

    try {
      // 1. Submit to Local Backend Endpoint
      const localResponse = await fetch(`${apiBaseUrl}/api/feedback`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          email: feedbackForm.email,
          category: feedbackForm.category,
          message: feedbackForm.message
        })
      });

      if (!localResponse.ok) {
        console.warn("Local backend feedback endpoint failed, proceeding with Web3Forms...");
      }

      // 2. Submit to Web3Forms if Key is configured
      const web3Key = import.meta.env.VITE_WEB3FORMS_KEY || "";
      if (web3Key && web3Key !== "YOUR_WEB3FORMS_ACCESS_KEY") {
        const web3Response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            access_key: web3Key,
            subject: `MythWeaver Feedback: ${feedbackForm.category}`,
            from_name: "MythWeaver App",
            email: feedbackForm.email,
            category: feedbackForm.category,
            message: feedbackForm.message
          })
        });
        
        if (!web3Response.ok) {
          console.error("Web3Forms submission failed");
        }
      }

      setFeedbackSuccess(true);
      setFeedbackForm({email: "", category: "Help & Support", message: ""});
    } catch (err) {
      console.error("Feedback submission error:", err);
      setFormError("Failed to send feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <motion.div
      className="page-overlay-fullscreen"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      onClick={onClose}
    >
      <motion.div
        className="overlay-content-card glass-panel"
        initial={{scale: 0.95, y: 20, opacity: 0}}
        animate={{scale: 1, y: 0, opacity: 1}}
        exit={{scale: 0.95, y: 20, opacity: 0}}
        transition={{type: "spring", duration: 0.5}}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="overlay-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {!feedbackSuccess ? (
          <>
            <h2 className="gradient-text overlay-title">Help & Suggestions</h2>
            <p className="help-intro">
              Need help or have suggestions? Send us a message and we'll get back to you!
            </p>
            {formError && (
              <div className="error-message" style={{marginBottom: "20px"}}>
                {formError}
              </div>
            )}
            <form onSubmit={handleFeedbackSubmit} className="feedback-form">
              <div className="form-group">
                <label htmlFor="feedback-email">Email Address</label>
                <input
                  id="feedback-email"
                  type="email"
                  required
                  value={feedbackForm.email}
                  onChange={(e) => setFeedbackForm({...feedbackForm, email: e.target.value})}
                  placeholder="yourname@example.com"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="feedback-category">How can we help?</label>
                <select
                  id="feedback-category"
                  value={feedbackForm.category}
                  onChange={(e) => setFeedbackForm({...feedbackForm, category: e.target.value})}
                  className="form-select"
                >
                  <option value="Help & Support">Help & Support</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Feature Suggestion">Feature Suggestion</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="feedback-message">Message or Suggestion</label>
                <textarea
                  id="feedback-message"
                  required
                  rows={4}
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({...feedbackForm, message: e.target.value})}
                  placeholder="Describe your issue or share your suggestions to make MythWeaver better..."
                  className="form-textarea"
                />
              </div>
              <button type="submit" disabled={submittingFeedback} className="submit-btn feedback-submit-btn">
                {submittingFeedback ? (
                  <>
                    <Loader2 className="spinner" size={18} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="success-state-container">
            <CheckCircle2 size={64} className="success-icon" />
            <h3 className="gradient-text">Thank You!</h3>
            <p>Your suggestions and message have been sent successfully. We appreciate your feedback to improve MythWeaver.</p>
            <button
              className="submit-btn close-success-btn"
              onClick={onClose}
            >
              Back to Weaver
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default HelpOverlay;
