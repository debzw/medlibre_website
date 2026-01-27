import * as React from "react";
import { cn } from "@/lib/utils";

export const MedLibreLogo = React.forwardRef<SVGSVGElement, React.ComponentPropsWithoutRef<"svg">>(
    ({ className, ...props }, ref) => {
        return (
            <svg
                ref={ref}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-5 w-5", className)}
                {...props}
            >
                <path
                    d="M20 20 V80 H80"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M20 20 L50 60 L80 20 V50"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
);

MedLibreLogo.displayName = "MedLibreLogo";
