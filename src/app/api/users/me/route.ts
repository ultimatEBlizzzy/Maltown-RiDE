import { NextRequest } from "next/server";
import { getDriverBundle } from "@/lib/drivers-service";
import { toUserDto } from "@/lib/dto";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req);
    if (user.role === "DRIVER") {
      const bundle = await getDriverBundle(user.id);
      return Response.json({
        user: toUserDto(user),
        driver: {
          isOnline: bundle.profile.isOnline,
          rating: bundle.profile.rating,
          totalTrips: bundle.profile.totalTrips,
          totalEarnings: bundle.profile.totalEarnings,
          verificationStatus: bundle.profile.verificationStatus,
          licenseNumber: bundle.profile.licenseNumber,
        },
        vehicle: bundle.vehicle,
      });
    }
    return Response.json({ user: toUserDto(user) });
  });
}
