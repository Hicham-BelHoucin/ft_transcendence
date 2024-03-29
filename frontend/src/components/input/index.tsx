"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, RefObject, useState, ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	className?: string;
	label?: string;
	htmlType?: string;
	error?: string;
	value?: string;
	placeholder?: string;
	onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
	onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
	options?: {
		value: string;
		label: string;
	}[];
	pattern?: string;
	isError?: boolean;
	inputRef?: RefObject<HTMLInputElement>;
	MaxLength?: number;
	hidden?: boolean;
	disabled?: boolean;
	required?: boolean;
	name?: string;
	id?: string;
	type?: string;
	success?: boolean;
	defaultValue?: string;
}

const Input = ({
	inputRef,
	className,
	label,
	error,
	name,
	value,
	onChange,
	onKeyDown,
	onBlur,
	htmlType = "text",
	placeholder,
	options,
	pattern,
	MaxLength,
	id,
	isError,
	hidden,
	disabled,
	defaultValue,
	type = "text",
	success = false,
	required,
}: InputProps) => {
	const [showPassword, setShowPassword] = useState(false);
	return (
		<>
			{type !== "select" && (
				<div className={twMerge("relative w-full")}>
					<input
						type={
							htmlType === "password"
								? showPassword
									? "text"
									: "password"
								: htmlType
						}
						className={twMerge(
							`peer m-0 block h-14  w-full rounded border border-solid border-quaternary-200 bg-transparent bg-clip-padding px-3 py-4 text-lg font-semibold leading-tight text-quaternary-50 
          transition ease-linear placeholder:text-transparent focus:border-primary focus:outline-none
          focus:border-primary-500 focus:text-primary-500 focus:backdrop-blur-sm peer-focus:text-primary-500`,
							label &&
								`focus:pb-[0.625rem] focus:pt-[1.625rem] [&:not(:placeholder-shown)]:pb-[0.625rem] [&:not(:placeholder-shown)]:pt-[1.625rem]`,
							isError && `border-red-700 text-red-700 animate-[pulse_1s]`,
							value &&
								`backdrop-blur-sm disabled:cursor-not-allowed disabled:border-primary-700 disabled:text-primary-700`,
							!value &&
								`disabled:cursor-not-allowed disabled:border-gray-500 disabled:text-gray-500`,
							success &&
								`border-green-700 text-green-700 disabled:border-green-700 disabled:text-green-700`,
							className
						)}
						id={id}
						name={name}
						required={required}
						disabled={disabled}
						placeholder={""}
						value={value}
						onChange={onChange}
						onKeyDown={onKeyDown}
						pattern={pattern}
						maxLength={MaxLength}
						hidden={hidden}
						ref={inputRef}
						onBlur={onBlur}
					/>
					{htmlType === "password" && (
						<div
							className={twMerge(
								"absolute right-0 top-0 h-full flex items-center justify-center pr-3 cursor-pointer",
								error && "-top-3"
							)}
							onClick={() => setShowPassword(!showPassword)}
						>
							{!showPassword && (
								<EyeOff className="w-6 h-6 text-quaternary-50 opacity-50" />
							)}
							{showPassword && <Eye className="w-6 h-6 text-primary-500" />}
						</div>
					)}
					{label && (
						<label
							htmlFor={id}
							className={twMerge(
								`pointer-events-none absolute left-0 top-0 origin-[0_0] border border-solid border-transparent px-3 py-4 transition-[opacity,_transform]
     ease-linear peer-focus:-translate-y-2 peer-focus:translate-x-[0.15rem] peer-focus:scale-[0.85] peer-focus:text-primary-500 peer-[:not(:placeholder-shown)]:-translate-y-2
        peer-[:not(:placeholder-shown)]:translate-x-[0.15rem] peer-[:not(:placeholder-shown)]:scale-[0.85] motion-reduce:transition-none text-quaternary-200`,
								disabled && value && "text-primary-700",
								isError && "text-red-700",
								success && `text-green-700`
							)}
						>
							{label}
						</label>
					)}
					{error && (
						<p className="mt-2 text-xs text-red-600">
							<span className="font-medium">{error}</span>
						</p>
					)}
				</div>
			)}
			{type === "select" && (
				<div className="flex flex-col gap-2 w-full ">
					{label && (
						<label
							htmlFor="countries"
							className="block text-sm font-medium text-gray-900 dark:text-white"
						>
							{label}
						</label>
					)}
					<select
						id="countries"
						className={twMerge(
							"block w-full rounded-lg bg-transparent border-2 border-tertiary-200 text-white px-10 py-3",
							className
						)}
						value={value}
						defaultValue={defaultValue}
						onChange={(e: any) => {
							onChange && onChange(e);
						}}
					>
						{options &&
							options.map((item, i) => {
								return (
									<option
										key={i}
										className="w-full px-4 py-2 border-b"
										value={item.value}
									>
										{item.label}
									</option>
								);
							})}
					</select>
				</div>
			)}
		</>
	);
};

export default Input;
