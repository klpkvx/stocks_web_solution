import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/stock/AAPL",
      permanent: false
    }
  };
};

export default function StockIndexRedirectPage() {
  return null;
}
