import {
	useContext,
	useEffect,
	useState,
	KeyboardEvent,
} from "react";
import { Card, Button, Spinner, Input } from "./../../components";
import axios from "axios";
import { AppContext } from "./../../context/app.context";
import { Link, Navigate } from "react-router-dom";
import { useFormik } from "formik";
import { twMerge } from "tailwind-merge";

const Login = () => {
	const { authenticated, fetchUser } = useContext(AppContext);
	const [loading, setLaoding] = useState<boolean>(true);
	const [twoFactorAuth, setTwoFactorAuth] = useState<boolean>(false);
	const [error, setError] = useState("");
	const formik = useFormik({
		initialValues: {
			username: "",
			password: "",
		},
		validateOnChange: false,
		validateOnBlur: true,
		validate: (values) => {
			const errors: {
				username?: string;
				password?: string;
			} = {};

			if (!values.username) {
				errors.username = "Please enter your username";
			} else if (!values.password) {
				errors.password = "Please enter your password";
			}

			return errors;
		},
		onSubmit: async (values) => {},
	});

	const handleLogin = async () => {
		try {
			setError("");
			formik.validateForm();

			if (
				Object.keys(formik.errors).length > 0 ||
				Object.keys(await formik.validateForm()).length > 0
			) {
				return;
			}
			const res = await axios.post(
				`${process.env.REACT_APP_BACK_END_URL}api/auth/signin`,
				{
					username: formik.values.username,
					password: formik.values.password,
				}
			);
			if (res.data.name) {
				setTwoFactorAuth(res.data.name === "2fa_access_token");
				window.localStorage?.setItem(res.data.name, res.data.value);
				await fetchUser();
			}
		} catch (_e) {
			setError("Incorrect username or password");
			console.log(_e);
		}
	};

	const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			handleLogin();
		}
	};

	useEffect(() => {
		(async () => {
			try {
				const res = await axios(
					`${process.env.REACT_APP_BACK_END_URL}api/auth/42/login`
				);
				if (res.data.name) {
					setTwoFactorAuth(res.data.name === "2fa_access_token");
					window.localStorage?.setItem(res.data.name, res.data.value);
					await fetchUser();
				}
				setLaoding(false);
			} catch (_e) {
				setLaoding(false);
			}
		})();
	}, [fetchUser]);

	if (loading) {
		return <Spinner />
	}

	if (authenticated) {
		return <Navigate to="/" />;
	}

	if (twoFactorAuth) return <Navigate to="/tfa" />;
	return (
		<div className="grid place-items-center w-full">
		<div className="flex flex-col items-center justify-center w-full max-w-sm md:max-w-md lg:max-w-lg gap-4 px-8 py-12 text-white">
		<h1 className="text-2xl">Welcome Back</h1>
		<p className=" text-tertiary-200">
			Please enter your credentials
		</p>
			<Input
				value={formik.values.username}
				error={formik.errors.username}
				isError={!!formik.errors.username}
				onChange={formik.handleChange}
				name="username"
				label="Username"
				onBlur={formik.handleBlur}
			/>
			<Input
				value={formik.values.password}
				error={formik.errors.password}
				isError={!!formik.errors.password}
				onChange={formik.handleChange}
				name="password"
				label="Password"
				htmlType="password"
				onBlur={formik.handleBlur}
			/>
			{error && (
				<p className="mt-2 text-xs text-red-600 dark:text-red-500">
					<span className="font-medium">{error}</span>
				</p>
			)}
			<Button className="w-full" onClick={handleLogin}>
				Sign in
			</Button>
			<div className="flex w-full items-center gap-2">
				<hr className="w-[70%] border-gray-500" />
				or
				<hr className="w-[70%] border-gray-500" />
			</div>
			<div className="flex w-full justify-center gap-4 md:flex-col">
				<Link
					to={`${process.env.REACT_APP_BACK_END_URL}api/auth/42/callback`}
				>
					<Button
						type="secondary"
						className="h-14 w-14 justify-center rounded-full md:h-auto md:w-full text-sm"
					>
						<img
							src="/img/42Logo-light.svg"
							alt="logo"
							width={30}
						/>
						<p className="hidden md:block">Continue with Intra</p>
					</Button>
				</Link>
				<Link
					to={`${process.env.REACT_APP_BACK_END_URL}api/auth/google/login`}
				>
					<Button
						type="secondary"
						className="h-14 w-14 justify-center rounded-full md:h-auto md:w-full text-sm"
						disabled={
							formik.dirty
						}
					>
						<img src="/img/google.svg" alt="logo" width={30} />
						<p className="hidden md:block">Continue with Google</p>
					</Button>
				</Link>
			</div>
			{/* <div className="flex w-full flex-col items-center justify-center pt-1 text-center text-tertiary-300 md:flex-row">
				Don't have an account?
				<Link
					to="/signup"
					className="duration-400 ml-1 text-tertiary-100 underline  transition ease-in-out hover:scale-105 hover:text-primary-500"
				>
					Sign up
				</Link>
			</div> */}
		</div>
		</div>
	);
};

export default Login;