import { useId, useState } from "react";

function EyeIcon() {
  return (
    <svg
      className="profileEyeIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="profileEyeIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 7a5 5 0 0 1 5 5c0 .64-.13 1.25-.35 1.81l2.92 2.92A11.9 11.9 0 0 0 23 12c-1.73-4.39-6-7.5-11-7.5-1.27 0-2.49.21-3.62.58l2.15 2.15C10.99 7.13 11.48 7 12 7zM2.71 3.16 1.3 4.57l2.55 2.55A11.86 11.86 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.46 2.46 1.41-1.41L2.71 3.16zM12 17a5 5 0 0 1-5-5c0-.64.13-1.25.35-1.81l1.69 1.69A3 3 0 0 0 12 15c.31 0 .61-.05.9-.13l1.72 1.72c-.79.26-1.65.41-2.62.41z" />
    </svg>
  );
}

export default function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled = false,
  autoFocus = false,
}) {
  const inputId = useId();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="profileField">
      <label className="profileFieldLabel" htmlFor={inputId}>
        {label}
      </label>

      <div className="profileInputWrap">
        <input
          id={inputId}
          className="profileInput"
          type={isVisible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={15}
          disabled={disabled}
          autoFocus={autoFocus}
        />

        <button
          type="button"
          className="profileEyeBtn"
          onClick={() => setIsVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={isVisible ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
