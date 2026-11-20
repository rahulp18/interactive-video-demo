import { Nunito } from "next/font/google";

/** Rounded, friendly face for the student shell only. `preload: false` keeps it off teacher pages; it loads when used. */
export const studentFont = Nunito({ variable: "--font-student", subsets: ["latin"], display: "swap", preload: false });
