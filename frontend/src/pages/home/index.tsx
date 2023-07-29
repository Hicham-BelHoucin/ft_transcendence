import {
  Avatar,
  Container,
  ChatBanner,
  GameBanner,
  UserBanner,
  Spinner,
  Toast,
} from "../../components";
import { useContext } from "react";
import { AppContext, fetcher } from "../../context/app.context";
import { Link, Navigate } from "react-router-dom";
import Layout from "../layout";
import useSWR from "swr";
import IUser from "../../interfaces/user";

const LeaderBoard = () => {
  const { data: users, isLoading } = useSWR("api/users", fetcher, {
    errorRetryCount: 0,
  });
  return (
    <Container title="Leader Board" icon="/img/3dMedal.svg">
      {!isLoading ? (
        users &&
        users.map((user: IUser, i: number) => {
          return (
            <Link to={`/profile/${user?.id}`} key={user?.username}>
              <UserBanner
                rank={i + 1}
                showRank
                showRating
                user={user}
              />
            </Link>
          );
        })
      ) : (
        <Spinner />
      )}
    </Container>
  );
};

const FriendList = () => {
  const { user } = useContext(AppContext);
  const { data: friends, isLoading } = useSWR(
    `api/users/${user?.id}/friends`,
    fetcher,
    {
      errorRetryCount: 0,
    }
  );
  return (
    <Container title="FRIEND LIST" icon="/img/friendlist.svg">
      {!isLoading ? (
        friends &&
        friends.map((user: IUser) => {
          return <Link to={`/profile/${user?.id}`} key={user?.id}>
            <UserBanner showRating user={user} />
          </Link>
        })
      ) : (
        <Spinner />
      )}
    </Container>
  );
};

const LiveFeed = () => {
  const { data: matches, isLoading } = useSWR("api/pong/live-games", fetcher, {
    errorRetryCount: 0,
  });
  return (
    <Container title="LIVE FEED" icon="/img/3dCam.svg">
      {!isLoading ? (
        matches &&
        matches.map((match: any) => {
          return <Link to={`/pong/${match.player1.id}`} key={match?.id}>
            <GameBanner player1={match.player1} player2={match.player2} player1Score={match.player1Score}
              player2Score={match.player2Score} />
          </Link>
        })
      ) : (
        <Spinner />
      )}
    </Container>
  )
}

const MatchHistory = () => {
  const { user } = useContext(AppContext);

  const { data: matches, isLoading } = useSWR(`api/pong/match-history/${user?.id}`, fetcher, {
    errorRetryCount: 0,
  });
  console.log('match history => ', matches);
  return (<Container title="MATCH HISTORY" icon="/img/history.svg">
    {!isLoading ? (
      matches &&
      matches.map((match: any) => {
        return <Link to={``} key={match?.id}>
          <GameBanner player1={match.player1} player2={match.player2} player1Score={match.player1Score}
            player2Score={match.player2Score} />
        </Link>
      })
    ) : (
      <Spinner />
    )}
  </Container>)
}

export default function Home() {
  const { user } = useContext(AppContext);
  const { data: channels, isLoading } = useSWR("api/channels", fetcher, {
    errorRetryCount: 0,
  });

//order channels by number of members
  channels?.sort((a: any, b: any) => {
    return b.channelMembers.length - a.channelMembers.length;
  });

  if (isLoading) return <Spinner />;

  if (
    user &&
    new Date(user?.createdAt).toLocaleString() ===
    new Date(user?.updatedAt).toLocaleString()
  )
    return <Navigate to="/completeinfo" />;
  return (
    <Layout className="3xl:grid-cols-3 flex flex-col items-center gap-5 2xl:grid 2xl:grid-cols-2 2xl:place-items-center">
      <Link
        to={`/profile/${user?.id}`}
        className=" flex h-[500px] w-[88%] max-w-[800px] animate-fade-right flex-wrap items-center justify-center gap-4 rounded border-2 border-secondary-400 p-4 md:h-[200px] md:flex-nowrap"
      >
        <Avatar
          src={user?.avatar || ""}
          alt=""
          className="h-28 w-28 md:h-36 md:w-36"
        />
        <div className="flex flex-col justify-center gap-2 p-2">
          <span className="text-lg font-bold text-white">
            {user?.fullname || ""}
          </span>
          <span className="text-sm text-tertiary-50">@{user?.login || ""}</span>
        </div>
        <div className="flex items-start justify-between gap-4 text-sm">
          <div className="flex flex-col text-secondary-100 ">
            <span>Score</span>
            <span>Winning Rate</span>
            <span>Total Games</span>
          </div>
          <div className="flex flex-col text-white">
            <div className="flex gap-2">
              <span>{user?.rating}</span>
              <img src="/img/smalllogo.svg" alt="logo" width={20} />
            </div>
            <div className="flex ">
              <span>87 %</span>
            </div>
            <div className="flex">
              {user && <span>{user.wins + user.losses}</span>}
            </div>
          </div>
        </div>
      </Link>
      <LeaderBoard />
      <FriendList />
      <LiveFeed />
      <MatchHistory />
      <Container
        title="POPULAR ROOMS"
        icon="/img/3dchat.svg"
        className="!grid grid-cols-1 place-items-center xl:grid-cols-2"
      >
        {
          channels?.filter((channel: any) => channel.channelMembers.length >= 3).map((channel: any) => {
            return <ChatBanner key={channel.id} channel={channel} />
          })
        }
      </Container>
    </Layout>
  );
}