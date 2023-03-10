import { InputHTMLAttributes, RefObject } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  label?: string;
  htmlType?: "text" | "select" | "file";
  error?: string;
  value?: string;
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  options?: string[];
  pattern?: string;
  isError?: boolean;
  ref?: React.RefObject<HTMLInputElement>;
  inputRef?: RefObject<HTMLInputElement>;
  MaxLength?: number;
  hidden?: boolean;
}

const Input = ({
  inputRef,
  className,
  label,
  error,
  value,
  onChange,
  htmlType = "text",
  placeholder,
  options,
  pattern,
  MaxLength,
  id,
  isError,
  hidden,
}: InputProps) => {
  return (
    <div className="w-full">
      {htmlType !== "select" && (
        <>
          <label
            htmlFor={id}
            className={
              error
                ? "block mb-2 text-sm font-medium text-red-700 dark:text-red-500"
                : "block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            }
          >
            {label}
          </label>
          <input
            hidden={hidden}
            ref={inputRef}
            pattern={pattern}
            maxLength={MaxLength}
            type={htmlType}
            id={id}
            className={
              isError
                ? `bg-red-50 border border-red-500 text-red-900 placeholder-red-700 text-sm rounded-lg focus:ring-red-500 dark:bg-gray-700 focus:border-red-500 block w-full p-2.5 dark:text-red-500 dark:placeholder-red-500 dark:border-red-500 ${className}`
                : `bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 ${className}`
            }
            placeholder={placeholder}
            value={value}
            onChange={onChange}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-500">
              <span className="font-medium">{error}</span>
            </p>
          )}
        </>
      )}
      {htmlType === "select" && (
        <>
          <label
            htmlFor={id}
            className={`block mb-2 text-sm font-medium text-gray-900 dark:text-white ${className}`}
          >
            {label}
          </label>
          <select
            id={id}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          >
            <option selected>{value || "-- select an option --"}</option>
            {options &&
              options.map((item) => {
                return <option>{item}</option>;
              })}
          </select>
        </>
      )}
    </div>
  );
};

export default Input;
