import Studio from "./studio";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  return <Studio signedIn={!!user} signInPath={chatGPTSignInPath("/")} />;
}
