import { User } from "@db/entity/User.js";
import { logger } from "@utils/loggers.js";

export async function getUser(username: string) {
  try {
    const user = await User.findOne({
      where: { username },
    });

    return user;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function getUserWithSettings(username: string) {
  try {
    const user = await User.findOne({
      where: { username },
      relations: {
        settings: true,
      },
    });

    return user;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

export async function getUsersWithEnabledChannel() {
  try {
    return await User.find({ where: { channel: { isEnabled: true } } });
  } catch (error) {
    logger.error(error);
    throw error;
  }
}
