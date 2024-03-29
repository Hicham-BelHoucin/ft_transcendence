"use client";
import { ChatBanner, Input, Spinner, UserBanner } from "../../components";
import useSWR from "swr";
import { fetcher } from "../../context/app.context";
import Layout from "../layout/index";
import IUser from "../../interfaces/user";
import Link from "next/link";
import * as React from "react";

const options = [
	{ value: "api/users", label: "users" },
	{ value: `api/channels`, label: "channels" },
];

export default function Search() {
	const [value, setValue] = React.useState<string>("");
	const [selected, setSelected] = React.useState<string>("api/users");
	const [filtred, setFiltred] = React.useState<IUser[]>();
	let { data: users, isLoading } = useSWR(selected, fetcher, {
		errorRetryCount: 0,
		timeout: 1000,
	});

	React.useEffect(() => {
		if (users && (filtred || !value)) {
			if (selected === "api/users")
				setFiltred(
					users.filter((item: IUser) =>
						item.fullname.toLowerCase().includes(value.toLowerCase())
					)
				);
			else if (selected === "api/channels") {
				setFiltred(
					users.filter((item: any) =>
						item.name.toLowerCase().includes(value.toLowerCase())
					)
				);
			}
		} else setFiltred(users);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, users]);

	return (
		<Layout className="flex flex-col items-center gap-4 md:gap-8">
			<div className="flex w-full max-w-[500px] flex-col items-center justify-center gap-4">
				<div className="flex flex-col sm:flex-row w-full items-center gap-2">
					<Input
						className="w-full "
						label="Search"
						placeholder="Search Users, Games, Channels ...."
						value={value}
						onChange={(e) => {
							const { value } = e.target;
							setValue(value);
						}}
					/>
					<div className="w-full sm:w-[30%]">
						<Input
							className="px-2"
							type="select"
							value={selected}
							options={options}
							onChange={(e) => {
								const { value } = e.target;
								setSelected(value);
							}}
						/>
					</div>
				</div>
				<div className="flex w-full flex-col items-center justify-center gap-2">
					{isLoading ? (
						<Spinner />
					) : filtred?.length ? (
						filtred.map((item: any) => {
							return selected === "api/users" ? (
								<Link key={item.id} href={`/profile/${item.id}`} className="w-full">
									<UserBanner
										key={item.id}
										user={item}
										showRating
										rank={item.rating}
									/>
								</Link>
							) : (
								<ChatBanner key={item.id} channel={item} />
							);
						})
					) : (
						<div className="h-[500px] flex items-center justify-center text-2xl text-primary-500">
							No matches found
						</div>
					)}
				</div>
			</div>
		</Layout>
	);
}
