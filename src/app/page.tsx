import { ShowcaseClient } from "@/components/showcase/ShowcaseClient";

export default function Home() {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  return <ShowcaseClient phoneNumber={phoneNumber} />;
}
