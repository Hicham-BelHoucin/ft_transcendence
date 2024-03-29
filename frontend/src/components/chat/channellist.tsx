"use client";

import React, { use, useRef } from "react";

import { useContext, useEffect, useState } from "react";

import Channel from "./channel";
import { IAppContext, fetcher } from "../../context/app.context";
import {
	ChatContext,
	Ichannel,
	IchannelMember,
	IchatContext,
	Imessage,
} from "../../context/chat.context";
import Modal from "../modal";
import Input from "../input";
import Button from "../button";
import { AppContext } from "../../context/app.context";
import axios from "axios";
import { toast } from "react-toastify";
import { twMerge } from "tailwind-merge";
import { ListFilter, MessageSquarePlus } from "lucide-react";

interface ChannelListProps {
	className?: string;
	setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
	setCurrentChannel: React.Dispatch<React.SetStateAction<Ichannel | undefined>>;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setMessages: React.Dispatch<React.SetStateAction<Imessage[]>>;
	inputRef?: React.RefObject<HTMLInputElement>;
	checkBlock: (id: number) => boolean;
}

const ChannelList: React.FC<ChannelListProps> = ({
	className,
	setShowModal,
	setCurrentChannel,
	setOpen,
	setMessages,
	inputRef,
	checkBlock,
}: ChannelListProps) => {
	const [channels, setChannels] = useState<Ichannel[]>([]);
	const [archiveChannels, setArchiveChannels] = useState<Ichannel[]>([]);
	const [showArchive, setShowArchive] = useState<boolean>(false);
	const [password, setPassword] = useState<string>("");
	const [selectedChannel, setSelectedChannel] = useState<Ichannel | undefined>({} as Ichannel);
	const [modal, setModal] = useState<boolean>(false);
	const [search, setSearch] = useState<string>("");
	const [tempChannel, setTempChannel] = useState<Ichannel>();
	const { socket } = useContext<IchatContext>(ChatContext);
	const { user } = useContext<IAppContext>(AppContext);
	const [isFocused, setIsFocused] = useState<boolean>(false);
	const iRef = React.useRef<HTMLInputElement>(null);
	const { checkConnection } = useContext<IAppContext>(AppContext);
	const value = useRef<number>(0);

	const loadMessages = async (channelId: number | undefined) => {
		if (!user) return;
		const messages = await fetcher(`api/messages/${channelId}/${user?.id}`);
		return messages;
	};

	const onClick = async (channel: Ichannel): Promise<void | undefined> => {
		checkConnection();
		if (!user || !channel) return;
		value.current = channel.id || 0;
		const member = await fetcher(`api/channels/member/${user?.id}/${channel?.id}`);
		if (channel.isacessPassword && member.role !== "OWNER") {
			if (selectedChannel && selectedChannel.id === channel?.id) {
				setOpen(true);
				setCurrentChannel(channel);
				setSelectedChannel(channel);
				socket?.emit("reset_mssg_count", { channelId: channel?.id });
				setMessages(null as any as Imessage[]);
				const messages = await loadMessages(channel.id);
				if (messages && channel.id === value.current) setMessages(messages);
				inputRef?.current?.focus();
			} else {
				setModal(true);
				setTempChannel(channel);
			}
		} else {
			setOpen(true);
			setCurrentChannel(channel);
			setSelectedChannel(channel);
			socket?.emit("reset_mssg_count", { channelId: channel?.id });
			setMessages(null as any as Imessage[]);
			const messages = await loadMessages(channel.id);
			if (messages && channel.id === value.current) setMessages(messages);
			inputRef?.current?.focus();
		}
	};

	const accessChannel = async () => {
		const res = await axios.post(
			`${process.env.BACK_END_URL}api/channels/checkpass`,
			{ password, channelId: tempChannel?.id },
			{ withCredentials: true }
		);
		if (res.data === true) {
			setOpen(true);
			setCurrentChannel(tempChannel);
			setSelectedChannel(tempChannel);
			setModal(false);
			socket?.emit("reset_mssg_count", { channelId: tempChannel?.id });
			setMessages(null as any as Imessage[]);
			const messages = await loadMessages(tempChannel?.id);
			setMessages(messages);
			inputRef?.current?.focus();
		} else {
			toast.error("Wrong access password !");
		}
	};

	useEffect(() => {
		if (!user) return;
		fetcher(`api/channels/${user?.id}`).then((channels: Ichannel[]) => {
			channels.forEach((channel: Ichannel) => {
				if (channel.type === "CONVERSATION") {
					channel.name = channel.channelMembers?.filter(
						(member: IchannelMember) => member.userId !== user?.id
					)[0].user?.username;
					channel.avatar = channel.channelMembers?.filter(
						(member: IchannelMember) => member.userId !== user?.id
					)[0].user?.avatar;
				}
			});
			setChannels(channels);
		});

		fetcher(`api/channels/archived/${user?.id}`).then((channels) => {
			setArchiveChannels(channels);
		});
		//eslint-disable-next-line
	}, [socket, user?.id]);

	useEffect(() => {
		if (search === "") {
			getuserChannels();
			getNewChannel();
			getArchiveChannels();
		}
		socket?.on("channel_leave", () => {
			setCurrentChannel({} as Ichannel);
			inputRef?.current?.blur();
			setOpen(false);
		});

		socket?.on("channel_access", (data: { channel: Ichannel; messages: Imessage[] }) => {
			setOpen(true);
			setCurrentChannel(data?.channel);
			setSelectedChannel(data?.channel);
			setMessages(data?.messages);
			// inputRef?.current?.focus();
		});

		socket?.on("channel_delete", () => {
			setCurrentChannel({} as Ichannel);
			inputRef?.current?.blur();
			setOpen(false);
		});

		return () => {
			socket?.off("channel_leave");
			socket?.off("channel_delete");
			socket?.off("getChannels");
			socket?.off("getArchiveChannels");
			socket?.off("channel_access");
		};
		//eslint-disable-next-line
	});

	const fetchChannels = async () => {
		const channels = await fetcher(`api/channels/${user?.id}`);
		channels.forEach((channel: Ichannel) => {
			if (channel.type === "CONVERSATION") {
				channel.name = channel.channelMembers?.filter(
					(member: IchannelMember) => member.userId !== user?.id
				)[0].user?.username;
				channel.avatar = channel.channelMembers?.filter(
					(member: IchannelMember) => member.userId !== user?.id
				)[0].user?.avatar;
			}
		});
		setChannels(channels);
	};

	const getuserChannels = async () => {
		socket?.on("getChannels", (channels: Ichannel[]) => {
			if (!channels) return;
			channels?.forEach((channel: Ichannel) => {
				if (channel.type === "CONVERSATION") {
					channel.name = channel.channelMembers?.filter(
						(member: IchannelMember) => member.userId !== user?.id
					)[0].user?.username;
					channel.avatar = channel.channelMembers?.filter(
						(member: IchannelMember) => member.userId !== user?.id
					)[0].user?.avatar;
				}
			});
			setChannels(channels);
		});
	};

	const getArchiveChannels = async () => {
		socket?.on("getArchiveChannels", (channels: Ichannel[]) => {
			if (!channels) return;
			setArchiveChannels(channels);
		});
	};

	const getNewChannel = async () => {
		socket?.on("channel_create", (channel: Ichannel) => {
			setCurrentChannel(channel);
			setSelectedChannel(channel);
			inputRef?.current?.focus();
		});
		socket?.on("dm_create", (channel: Ichannel) => {
			setCurrentChannel(channel);
			setSelectedChannel(channel);
			inputRef?.current?.focus();
		});
	};

	const onChange = (e: any) => {
		e.preventDefault();
		const { value } = e.target;
		setSearch(value);
		if (value.trim().length > 0) {
			setChannels(
				channels.filter((item: Ichannel) =>
					item.name.toLowerCase().includes(value.toLowerCase())
				)
			);
		} else {
			fetchChannels();
		}
	};

	return (
		<>
			<div
				className={twMerge(
					"lg:col-span-3 relative col-span-10 flex flex-col justify-start gap-4 py-2 w-full h-screen overflow-y-scroll scrollbar-hide",
					className && className
				)}
			>
				<div className=" sticky top-0 z-30 flex items-center gap-2 w-full pr-2 bg-secondary-50 py-2">
					<form className="pl-4 pr-1 w-full">
						<div className="relative">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="absolute top-0 bottom-0 w-6 h-6 my-auto text-secondary-400 text-xs left-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<input
								type="text"
								placeholder="Search chats..."
								className="w-full py-2 pl-12 pr-4 text-secondary-400 border border-tertiary-700 rounded-md outline-none bg-secondary-300 focus:text-primary-400 focus:border-primary-200 placeholder-secondary-400 placeholder-text-sm"
								value={search}
								onChange={onChange}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										inputRef?.current?.blur();
									}
								}}
							/>
						</div>
					</form>
					<MessageSquarePlus
						size={35}
						style={{ color: "#727587", fontSize: "30px", cursor: "pointer" }}
						onClick={() => {
							setShowModal(true);
						}}
					/>
					<ListFilter
						size={35}
						style={{
							color: isFocused ? "#E5AC7C" : "#727587",
							fontSize: "60px",
							cursor: "pointer",
						}}
						onClick={() => {
							setIsFocused(!isFocused);
							setShowArchive(!showArchive);
						}}
					/>
				</div>
				{showArchive && (
					<div className="flex items-center flex-col gap-2 text-primary-500 font-bold text-md">
						FILTERED BY ARCHIVED
					</div>
				)}

				{!showArchive
					? channels
							?.filter(
								(channel: Ichannel) =>
									channel.pinnedFor
										?.map((user: any) => user.id)
										.includes(user?.id)
							)
							?.map((channel: Ichannel) => {
								const isActive = channel.id === selectedChannel?.id;
								return (
									<Channel
										key={channel.id}
										id={channel.id}
										name={
											channel.type !== "CONVERSATION"
												? channel.name
												: channel.channelMembers?.filter(
														(member: any) => member.userId !== user?.id
												  )[0].user?.username
										}
										pinned={channel.pinnedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										muted={channel.mutedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										archived={channel.archivedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										unread={channel.unreadFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										avatar={
											channel.type !== "CONVERSATION"
												? channel.avatar
												: channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId !== user?.id
												  )[0].user?.avatar
										}
										description={
											channel.messages &&
											!channel.bannedUsers
												?.map((user: any) => user.id)
												.includes(user?.id) &&
											!channel.kickedUsers
												?.map((user: any) => user.id)
												.includes(user?.id)
												? channel.messages[0]?.content
												: ""
										}
										updatedAt={
											channel.messages &&
											!channel.bannedUsers
												?.map((user: any) => user.id)
												.includes(user?.id) &&
											!channel.kickedUsers
												?.map((user: any) => user.id)
												.includes(user?.id)
												? channel.messages[0]?.date ||
												  channel.updatedAt ||
												  ""
												: channel.createAt || ""
										}
										newMessages={
											channel.channelMembers?.filter(
												(member: IchannelMember) =>
													member.userId === user?.id
											)[0].newMessagesCount
										}
										userStatus={
											channel.type !== "CONVERSATION"
												? false
												: channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId !== user?.id
												  )[0].user?.status === "ONLINE" &&
												  !checkBlock(
														channel.channelMembers?.filter(
															(member: IchannelMember) =>
																member.userId !== user?.id
														)[0].user?.id
												  )
										}
										onClick={async (e: any) => {
											e.preventDefault();
											await onClick(channel);
										}}
										selected={isActive}
									/>
								);
							})
							.concat(
								channels
									?.filter(
										(channel: Ichannel) =>
											!channel.pinnedFor
												?.map((user: any) => user.id)
												.includes(user?.id)
									)
									.map((channel: Ichannel) => {
										const isActive = channel.id === selectedChannel?.id;
										return (
											<Channel
												key={channel.id}
												id={channel.id}
												name={
													channel.type !== "CONVERSATION"
														? channel.name
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.username
												}
												pinned={channel.pinnedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												muted={channel.mutedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												archived={channel.archivedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												unread={channel.unreadFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												avatar={
													channel.type !== "CONVERSATION"
														? channel.avatar
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.avatar
												}
												description={
													channel.messages &&
													!channel.bannedUsers
														?.map((user: any) => user.id)
														.includes(user?.id) &&
													!channel.kickedUsers
														?.map((user: any) => user.id)
														.includes(user?.id)
														? channel.messages[0]?.content
														: ""
												}
												updatedAt={
													channel.messages &&
													!channel.bannedUsers
														?.map((user: any) => user.id)
														.includes(user?.id) &&
													!channel.kickedUsers
														?.map((user: any) => user.id)
														.includes(user?.id)
														? channel.messages[0]?.date ||
														  channel.updatedAt ||
														  ""
														: channel.createAt || ""
												}
												newMessages={
													channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId === user?.id
													)[0].newMessagesCount
												}
												userStatus={
													channel.type !== "CONVERSATION"
														? false
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.status === "ONLINE" &&
														  !checkBlock(
																channel.channelMembers?.filter(
																	(member: IchannelMember) =>
																		member.userId !== user?.id
																)[0].user?.id
														  )
												}
												onClick={async (e: any) => {
													e.preventDefault();
													await onClick(channel);
												}}
												selected={isActive}
											/>
										);
									})
							)
					: archiveChannels
							?.filter(
								(channel: Ichannel) =>
									channel.pinnedFor
										?.map((user: any) => user.id)
										.includes(user?.id)
							)
							?.map((channel: Ichannel) => {
								//list the pinned channels first
								const isActive = channel.id === selectedChannel?.id;
								return (
									<Channel
										key={channel.id}
										id={channel.id}
										name={
											channel.type !== "CONVERSATION"
												? channel.name
												: channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId !== user?.id
												  )[0].user?.username
										}
										pinned={channel.pinnedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										muted={channel.mutedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										archived={channel.archivedFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										unread={channel.unreadFor
											?.map((user: any) => user.id)
											.includes(user?.id)}
										avatar={
											channel.type !== "CONVERSATION"
												? channel.avatar
												: channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId !== user?.id
												  )[0].user?.avatar
										}
										description={
											channel.messages &&
											!channel.bannedUsers
												?.map((user: any) => user.id)
												.includes(user?.id) &&
											!channel.kickedUsers
												?.map((user: any) => user.id)
												.includes(user?.id)
												? channel.messages[0]?.content
												: ""
										}
										updatedAt={
											channel.messages &&
											!channel.bannedUsers
												?.map((user: any) => user.id)
												.includes(user?.id) &&
											!channel.kickedUsers
												?.map((user: any) => user.id)
												.includes(user?.id)
												? channel.messages[0]?.date ||
												  channel.updatedAt ||
												  ""
												: channel.createAt || ""
										}
										newMessages={
											channel.channelMembers?.filter(
												(member: IchannelMember) =>
													member.userId === user?.id
											)[0].newMessagesCount
										}
										userStatus={
											channel.type !== "CONVERSATION"
												? false
												: channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId !== user?.id
												  )[0].user?.status === "ONLINE" &&
												  !checkBlock(
														channel.channelMembers?.filter(
															(member: IchannelMember) =>
																member.userId !== user?.id
														)[0].user?.id
												  )
										}
										onClick={async (e: any) => {
											e.preventDefault();
											await onClick(channel);
										}}
										selected={isActive}
									/>
								);
							})
							.concat(
								archiveChannels
									?.filter(
										(channel: Ichannel) =>
											!channel.pinnedFor
												?.map((user: any) => user.id)
												.includes(user?.id)
									)
									.map((channel: Ichannel) => {
										const isActive = channel.id === selectedChannel?.id;
										return (
											<Channel
												key={channel.id}
												id={channel.id}
												name={
													channel.type !== "CONVERSATION"
														? channel.name
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.username
												}
												pinned={channel.pinnedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												muted={channel.mutedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												archived={channel.archivedFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												unread={channel.unreadFor
													?.map((user: any) => user.id)
													.includes(user?.id)}
												avatar={
													channel.type !== "CONVERSATION"
														? channel.avatar
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.avatar
												}
												description={
													channel.messages &&
													!channel.bannedUsers
														?.map((user: any) => user.id)
														.includes(user?.id) &&
													!channel.kickedUsers
														?.map((user: any) => user.id)
														.includes(user?.id)
														? channel.messages[0]?.content
														: ""
												}
												updatedAt={
													channel.messages &&
													!channel.bannedUsers
														?.map((user: any) => user.id)
														.includes(user?.id) &&
													!channel.kickedUsers
														?.map((user: any) => user.id)
														.includes(user?.id)
														? channel.messages[0]?.date ||
														  channel.updatedAt ||
														  ""
														: channel.createAt || ""
												}
												newMessages={
													channel.channelMembers?.filter(
														(member: IchannelMember) =>
															member.userId === user?.id
													)[0].newMessagesCount
												}
												userStatus={
													channel.type !== "CONVERSATION"
														? false
														: channel.channelMembers?.filter(
																(member: IchannelMember) =>
																	member.userId !== user?.id
														  )[0].user?.status === "ONLINE" &&
														  !checkBlock(
																channel.channelMembers?.filter(
																	(member: IchannelMember) =>
																		member.userId !== user?.id
																)[0].user?.id
														  )
												}
												onClick={async (e: any) => {
													e.preventDefault();
													await onClick(channel);
												}}
												selected={isActive}
											/>
										);
									})
							)}
			</div>
			{modal && (
				<Modal
					setShowModal={setModal}
					className="z-10 bg-secondary-800 
                      border-none flex flex-col items-center justify-center shadow-lg shadow-secondary-500 gap-4 text-white min-w-[90%]
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
							value={password}
							inputRef={iRef}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={async (e) => {
								if (e.key === "Enter") {
									await accessChannel();
									setModal(false);
									iRef?.current?.blur();
									setPassword("");
								}
							}}
						/>
						<div className="flex flex-row pt-4">
							<Button
								className="h-10 w-20 md:w-30 !bg-inherit text-white text-xs rounded-full mt-2 mr-2"
								onClick={() => {
									setModal(false);
									iRef?.current?.blur();
								}}
							>
								<span className="text-xs">Cancel</span>
							</Button>
							<Button
								className="h-10 w-20 md:w-30 bg-primary-500 text-white text-xs rounded-full mt-2"
								onClick={async () => {
									await accessChannel();
									setModal(false);
									setPassword("");
									iRef?.current?.blur();
								}}
							>
								<span className="text-xs">Access</span>
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
};

export default ChannelList;
