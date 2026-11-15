import { useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export default function ProfileModal({
  title,
  description,
  tone = "default",
  isBusy = false,
  onClose,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef(null);

  // Пока окно открыто, страница под ним не прокручивается.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const firstInput = modalRef.current?.querySelector("input");

    document.body.style.overflow = "hidden";
    firstInput?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!isBusy) onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);

      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget && !isBusy) onClose();
  };

  return (
    <div className="profileModalOverlay" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={modalRef}
        className={`profileModal ${tone === "danger" ? "profileModal-danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="profileModalHeader">
          <div className="profileModalHeading">
            <h2 className="profileModalTitle" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="profileModalDescription" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="profileModalClose"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Закрыть окно"
          >
            &times;
          </button>
        </header>

        {children}
      </section>
    </div>
  );
}
