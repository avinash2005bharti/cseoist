import connectDB from '../config/db.js';
import env from '../config/env.js';
import Section from '../models/Section.js';

export const updateSectionCapacity = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>')) {
    throw new Error('Please set a valid MONGODB_URI/MONGO_URI before updating section capacity.');
  }

  await connectDB();
  const result = await Section.updateMany({}, { $set: { capacity: 90 } });
  const total = await Section.countDocuments();

  return { matched: result.matchedCount, updated: result.modifiedCount, total, capacity: 90 };
};

if (process.argv[1] && process.argv[1].endsWith('update-section-capacity.js')) {
  updateSectionCapacity()
    .then(({ updated, total, capacity }) => {
      console.log(`Updated ${updated} section(s) to capacity ${capacity}. Total sections: ${total}.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Section capacity update failed: ${error.message}`);
      process.exit(1);
    });
}
