"use client";
import { Button, Card, Carousel, Input, RadioCheck, Spinner, UserBanner } from "@/components";
import useSwr from "swr";
import { AppContext, fetcher } from "@/context/app.context";
import { GameContext } from "@/context/game.context";
import IUser from "@/interfaces/user";
import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Image from "next/image";
import { SocketContext } from "@/context/socket.context";

const CreateGameCard = ({
	onClick,
	onCancel,
	title,
	showLoading,
	content,
	showOptions,
	disabled,
	name,
	className,
	invite,
	gameMode,
	setGameMode,
	gameOption,
	setGameOption,
}: {
	onClick: () => void;
	onCancel: () => void;
	title: string;
	showLoading?: boolean;
	showOptions?: boolean;
	content: string;
	disabled?: boolean;
	name?: string;
	className?: string;
	invite?: boolean;
	gameMode?: string;
	setGameMode?: React.Dispatch<React.SetStateAction<string>>;
	gameOption?: string;
	setGameOption?: React.Dispatch<React.SetStateAction<string>>;
}) => {
	const { data: users, isLoading } = useSwr("api/users", fetcher, {
		errorRetryCount: 0,
		refreshInterval: 1000,
	});
	const [value, setValue] = useState<string>("");
	const [show, setShow] = useState<boolean>(false);
	const [showModal, setShowModal] = useState<boolean>(false);
	const [selectedUser, setSelectedUser] = useState<IUser>();
	const [filtred, setFiltred] = useState<IUser[]>();
	const { socket } = useContext(GameContext);
	const notificationSocket = useContext(SocketContext);
	const { user } = useContext(AppContext);

	useEffect(() => {
		if (users && (filtred || !value))
			setFiltred(
				users.filter(
					(item: IUser) =>
						item.fullname.toLowerCase().includes(value.toLowerCase()) &&
						item.status === "ONLINE" &&
						item.id !== user?.id
				)
			);
		else
			setFiltred(
				users?.filter((item: IUser) => item.status === "ONLINE" && item.id !== user?.id)
			);
	}, [value, users]);

	useEffect(() => {
		notificationSocket?.on("invitation-canceled", () => {
			setShow(false);
			setShowModal(false);
		});

		socket?.emit("check-for-invitaion-sent");
		socket?.on("check-for-invitaion-sent", (data: boolean) => {
			if (data) {
				setShow(true);
				setShowModal(true);
			}
		});

		socket?.on("game-over", () => {
			setShow(false);
			setShowModal(false);
		});

		return () => {};
	}, [socket]);

	return (
		<Card
			className={`
	relative flex w-full !max-w-md flex-col items-center gap-4 overflow-hidden bg-gradient-to-tr from-secondary-50  to-secondary-800 text-gray-400 
	${className}
	`}
		>
			<h1 className="text-center text-xl text-white">{title}</h1>
			{invite && showModal && (
				<div className="flex w-full flex-col items-center justify-center gap-2 ">
					<Input
						className="w-full"
						placeholder="Search Users ...."
						value={value}
						onChange={(e) => {
							const { value } = e.target;
							setValue(value);
						}}
					/>
					{isLoading ? (
						<Spinner />
					) : filtred?.length ? (
						<div className="flex h-full max-h-[350px] md:max-h-[500px] overflow-auto scrollbar-hide w-full flex-col">
							{filtred.map((item: IUser) => {
								return (
									<Button
										variant="text"
										className="!hover:bg-inherit w-full !bg-inherit !p-0"
										onClick={() => {
											setSelectedUser(item);
										}}
										key={item.id}
									>
										<UserBanner user={item} showRating rank={item.rating} />
									</Button>
								);
							})}
						</div>
					) : (
						<div className="flex items-center justify-center text-xs text-primary-500 md:text-2xl">
							No matches found
						</div>
					)}
					<span className="w-full">Selected User : </span>
					{selectedUser && (
						<UserBanner
							key={selectedUser.id}
							user={selectedUser}
							showRating
							rank={selectedUser.rating}
						/>
					)}
					<div className="flex w-full items-center justify-center gap-4">
						<Button
							onClick={() => {
								setShowModal(false);
							}}
						>
							Cancel
						</Button>
						<Button
							disabled={!!!selectedUser}
							onClick={() => {
								socket?.emit("invite-friend", {
									inviterId: user?.id,
									invitedFriendId: selectedUser?.id,
									gameMode: gameMode,
									powerUps: gameOption,
								});
								onClick();
								toast.success("Invitation sent successfully");
								setShowModal(false);
								setShow(true);
							}}
						>
							Invite
						</Button>
					</div>
				</div>
			)}
			{!showModal && (
				<>
					{showOptions ? (
						<>
							<RadioCheck
								value={gameMode}
								onChange={(e) => {
									setGameMode && setGameMode(e.target.value);
								}}
								htmlFor={"gamemode" + name}
								label="Select Game bet"
								options={["Classic Mode", "Ranked Mode", "Time Attack"]}
							/>
							<RadioCheck
								value={gameOption}
								onChange={(e) => {
									setGameOption && setGameOption(e.target.value);
								}}
								htmlFor={"gameoption" + name}
								label="Select Game Options"
								options={["Classic", "Power Shot", "ShrinkingPaddle"]}
							/>
						</>
					) : (
						<>
							<Image src="/img/game.png" alt="" width={200} height={200} />
						</>
					)}
					<Button
						className="px-16"
						onClick={() => {
							!invite && onClick();
							!invite && setShow(true);
							invite && setShowModal(true);
						}}
						disabled={disabled}
					>
						{content}
					</Button>
				</>
			)}
			{showLoading && show && (
				<>
					<div className="absolute inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm"></div>
					<div
						role="status"
						className="absolute left-1/2 top-2/4 grid -translate-x-1/2
             -translate-y-1/2 place-items-center gap-4"
					>
						<Spinner />
						<p className="text-white">Waiting for opponent</p>
						<Button
							onClick={() => {
								onCancel();
								setShow(false);
							}}
						>
							Cancel
						</Button>
					</div>
				</>
			)}
		</Card>
	);
};

export default function GameCards() {
	const [disabled, setDisabled] = useState<{
		invite: boolean;
		join: boolean;
	}>();
	const [gameMode, setGameMode] = useState<string>("Classic Mode");
	const [gameOption, setGameOption] = useState<string>("Classic");
	const { socket } = useContext(GameContext);
	const notificationSocket = useContext(SocketContext);
	const { user } = useContext(AppContext);
	let timeoutId: NodeJS.Timeout | null = null;

	useEffect(() => {
		notificationSocket?.on("invitation-canceled", () => {
			setDisabled({
				invite: false,
				join: false,
			});
		});
		socket?.emit("check-for-invitaion-sent");
		socket?.on("check-for-invitaion-sent", (data: boolean) => {
			if (data) {
				setDisabled({
					invite: true,
					join: false,
				});
			}
		});

		socket?.on("game-over", () => {
			setDisabled({
				invite: false,
				join: false,
			});
		});
		return () => {};
	}, [socket]);

	return (
		<Carousel
			className="w-full"
			chevrons={!disabled?.invite && !disabled?.join}
			swipeable={false}
		>
			<CreateGameCard
				invite
				title="Invite Your Friends to Play"
				content="Select Friend"
				name="Invite"
				onClick={() => {
					setDisabled({
						invite: false,
						join: true,
					});
					timeoutId = setTimeout(() => {
						setDisabled({
							invite: false,
							join: false,
						});
					}, 30000);
				}}
				showOptions
				showLoading
				gameMode={gameMode}
				setGameMode={setGameMode}
				gameOption={gameOption}
				setGameOption={setGameOption}
				disabled={disabled?.invite}
				onCancel={() => {
					socket?.emit("cancel-invite", {
						inviterId: user?.id,
					});
					setDisabled({
						invite: false,
						join: false,
					});
					timeoutId && clearTimeout(timeoutId);
				}}
			/>
			<CreateGameCard
				title="Train Against Ai"
				content="Play Now"
				onCancel={() => {}}
				onClick={() => {
					socket?.emit("play-with-ai", {
						userId: user?.id,
					});
				}}
			/>
			<CreateGameCard
				title="Play Against Random Users"
				content="Join The Queue"
				name="Join"
				gameMode={gameMode}
				setGameMode={setGameMode}
				gameOption={gameOption}
				setGameOption={setGameOption}
				onCancel={() => {
					socket?.emit("leave-queue", {
						userId: user?.id,
					});
					setDisabled({
						invite: false,
						join: false,
					});
				}}
				onClick={() => {
					socket?.emit("join-queue", {
						userId: user?.id,
						gameMode: gameMode,
						powerUps: gameOption,
					});
					setDisabled({
						invite: true,
						join: false,
					});
				}}
				showLoading
				showOptions
				disabled={disabled?.join}
			/>
		</Carousel>
	);
}
