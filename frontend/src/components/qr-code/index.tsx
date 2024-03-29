"use client";

import useSWR from "swr";
import { fetcher } from "../../context/app.context";
import Spinner from "../spinner";
import Image from "next/image";

const QrCode = () => {
	const { data: qrcode, isLoading } = useSWR("api/auth/2fa/qrcode", fetcher);

	return (
		<>
			{!isLoading ? (
				<Image
					src={qrcode || ""}
					alt="qrcode"
					className="border-4 border-secondary-400 rounded-xl"
					width={200}
					height={200}
				/>
			) : (
				<Spinner />
			)}
		</>
	);
};

export default QrCode;
