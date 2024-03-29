"use client";

import React, { useRef } from "react";

import { useContext, useState } from "react";
import { AppContext, fetcher } from "../../context/app.context";
import { ChatContext, Ichannel } from "../../context/chat.context";
import { useRouter } from "next/navigation";
import Avatar from "../avatar";
import AvatarGroup from "../avatarGroup";
import Button from "../button";
import Input from "../input";
import Modal from "../modal";
import axios from "axios";
import { toast } from "react-toastify";
import { Key, Users2 } from "lucide-react";

const ChatBanner = ({ channel }: { channel?: Ichannel }) => {
	const router = useRouter();

	const { user } = useContext(AppContext);
	const { socket } = useContext(ChatContext);
	const [password, setPassword] = useState("");
	const [accessPassword, setAccessPassword] = useState("");
	const [showModal, setshowModal] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [accesModal, setAccessModal] = useState(false);

	const channelMembers = channel?.channelMembers?.filter((member: any) => {
		return member.status === "ACTIVE" || member.status === "MUTED";
	});

	const handleJoin = () => {
		if (channel?.visiblity === "PROTECTED") {
			setshowModal(true);
			inputRef?.current?.focus();
		} else {
			socket?.emit("channel_join", { channelId: channel?.id, userId: user?.id });
			router.push(`/chat`);
		}
	};

	const handleAccess = async () => {
		try {
			const member = await fetcher(`api/channels/member/${user?.id}/${channel?.id}`);
			if (!member) return;

			if (
				(channel?.isacessPassword && member.role === "OWNER") ||
				!channel?.isacessPassword
			) {
				socket?.emit("channel_access", { userId: user?.id, channelId: channel?.id });
				router.push(`/chat`);
				return;
			} else {
				setAccessModal(true);
				return;
			}
		} catch (err) {
			toast.error("Something went wrong !");
		}
	};

	const accessChannel = async () => {
		try {
			const res = await axios.post(
				`${process.env.BACK_END_URL}api/channels/checkpass`,
				{ password: accessPassword, channelId: channel?.id },
				{ withCredentials: true }
			);
			if (res.data === true) {
				socket?.emit("channel_access", { userId: user?.id, channelId: channel?.id });
				router.push(`/chat`);
			} else {
				toast.error("Wrong access password !");
			}
		} catch (error) {}
	};

	return (
		<>
			<div className="flex flex-col  gap-2 border-2 border-secondary-400 rounded-md p-2 sm:p-4 shadow-sm shadow-secondary-400 max-w-[500px] w-full">
				<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
					<div className="w-full">
						<div className="text-white text-lg ">{channel?.name}</div>
						<div className="flex items-center text-sm text-tertiary-200 justify-between w-full sm:justify-start sm:gap-4">
							<div>{channelMembers?.length} Members</div>
							<div className="flex items-center gap-2">
								{channel?.visiblity === "PROTECTED" && <Key />}
								<Users2 /> {channel?.visiblity}
							</div>
						</div>
					</div>
					{channel &&
					(!channelMembers?.map((item: any) => item.userId).includes(user?.id) ||
						channel?.kickedUsers.map((u: any) => u.id).includes(user?.id)) ? (
						<Button onClick={handleJoin} className="w-full sm:w-auto ">
							Join
						</Button>
					) : (
						<Button onClick={handleAccess} className="w-full sm:w-auto ">
							Access
						</Button>
					)}
				</div>
				<AvatarGroup max={3}>
					{channelMembers &&
						channelMembers?.map((item: any) => {
							return (
								<Avatar
									key={item.userId}
									src={item.user.avatar}
									alt={item.user.username}
								/>
							);
						})}
				</AvatarGroup>
			</div>
			{accesModal && (
				<Modal
					setShowModal={setAccessModal}
					className2="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50"
					className="z-10 bg-secondary-800 
                                    border-none flex flex-col !items-center !justify-center shadow-lg shadow-secondary-500 gap-4 text-white min-w-[90%]
                                    lg:min-w-[40%] xl:min-w-[800px] animate-jump-in animate-ease-out animate-duration-400"
				>
					<span className="text-md md:text-lg font-semibold pb-4">
						This channel requires an access password !{" "}
					</span>
					<div className="flex flex-col justify-center items-center w-full">
						<Input
							label="Password"
							className="w-full rounded-md border-2 border-primary-500 text-white text-xs bg-transparent md:mr-2"
							htmlType="password"
							placeholder="*****************"
							value={accessPassword}
							// inputRef={iRef}
							onChange={(e) => setAccessPassword(e.target.value)}
							onKeyDown={async (e) => {
								if (e.key === "Enter") {
									await accessChannel();
									setAccessPassword("");
									setAccessModal(false);
									// iRef?.current?.blur();
								}
							}}
						/>
						<div className="flex flex-row p-4">
							<Button
								className="h-10 w-20 md:w-30 !bg-inherit text-white text-xs rounded-full mt-2 mr-2"
								onClick={() => {
									setAccessPassword("");
									setAccessModal(false);
									// iRef?.current?.blur();
								}}
							>
								<span className="text-xs">Cancel</span>
							</Button>
							<Button
								className="h-10 w-20 md:w-30 bg-primary-500 text-white text-xs rounded-full mt-2"
								onClick={async () => {
									await accessChannel();
									setAccessPassword("");
									setAccessModal(false);
									// iRef?.current?.blur();
								}}
							>
								<span className="text-xs">Access</span>
							</Button>
						</div>
					</div>
				</Modal>
			)}
			{showModal && (
				<Modal
					setShowModal={setshowModal}
					className2="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50"
					className="z-10 bg-secondary-800 border-none flex flex-col !items-center !justify-center shadow-lg shadow-secondary-500 gap-4 text-white min-w-[90%] lg:min-w-[40%] xl:min-w-[50%] animate-jump-in animate-ease-out animate-duration-400 max-w-[100%]"
				>
					<span className="text-md md:text-lg font-semibold pb-4">
						This channel is protected
					</span>
					<div className="flex flex-col justify-center items-center w-full">
						<Input
							label="Password"
							className="w-full rounded-md border-2 border-primary-500 text-white text-xs bg-transparent md:mr-2"
							htmlType="password"
							placeholder="*****************"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							inputRef={inputRef}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									socket?.emit("channel_join", {
										channelId: channel?.id,
										userId: user?.id,
										password: password,
									});
									setshowModal(false);
									setPassword("");
									router.push(`/chat`);
								}
							}}
						/>
						<div className="flex flex-row">
							<Button
								className="h-10 w-20 md:w-30 !bg-inherit text-white text-xs rounded-full mt-2 mr-2"
								onClick={() => {
									setshowModal(false);
									inputRef?.current?.blur();
									setPassword("");
								}}
							>
								<span className="text-xs">Cancel</span>
							</Button>
							<Button
								className="h-10 w-20 md:w-30 bg-primary-500 text-white text-xs rounded-full mt-2"
								onClick={() => {
									socket?.emit("channel_join", {
										channelId: channel?.id,
										userId: user?.id,
										password: password,
									});
									setshowModal(false);
									setPassword("");
									router.push(`/chat`);
								}}
							>
								<span className="text-xs">Join</span>
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
};

export default ChatBanner;
