import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import Journey from '../models/Journey';
import Episode, { IActivity } from '../models/Episode';
import Badge from '../models/Badge';
import { logger } from './logger';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/infano';

const createActivityList = (episodeNum: number): IActivity[] => {
  return [
    {
      _id: new Types.ObjectId(),
      type: 'intro_video',
      order: 1,
      xp_value: 5,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        video_url: 'https://assets.mixkit.co/videos/preview/mixkit-holding-a-cup-of-tea-in-bed-41865-large.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e',
        duration_seconds: 90,
        caption: `Welcome to Episode ${episodeNum}!`
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'story_card',
      order: 2,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        cards: [
          {
            character_name: 'Maya',
            character_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
            text: 'I used to feel so nervous when my period was due. I did not know what to expect.',
            illustration_url: 'https://images.unsplash.com/photo-1544026053-294711f11463',
            bg_color: '#FDF2F8'
          },
          {
            character_name: 'Maya',
            character_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
            text: 'But learning about my cycle helped me understand that my body is just doing its natural job.',
            illustration_url: 'https://images.unsplash.com/photo-1518152006812-edab29b069ac',
            bg_color: '#F5F3FF'
          }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'image_paragraph',
      order: 3,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
        image_alt: 'Cycle Phases Diagram',
        heading: 'Understanding the Foundations',
        body_text: 'The menstrual cycle is more than just your period. It is a series of hormonal changes designed to prepare the body for potential pregnancy. It is regulated by gland signals, primarily originating in the brain and ovaries, coordinating a complex cycle split into four distinct phases.',
        source_credit: 'Infano Medical Advisory Board'
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'character_dialogue',
      order: 4,
      xp_value: 10,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        characters: [
          { name: 'Riya', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
          { name: 'Dr. Kavita', avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2' }
        ],
        dialogue: [
          { character: 'Riya', line: 'Dr. Kavita, why do I feel so moody right before my period starts?', expression: 'confused' },
          { character: 'Dr. Kavita', line: 'That is very common, Riya! Progesterone levels drop quickly right before your period, which can affect serotonin, our happy hormone.', expression: 'reassuring' }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'multiple_choice',
      order: 5,
      xp_value: 15,
      is_required: true,
      estimated_minutes: 2,
      payload: {
        instructions: 'Test your understanding on basic cycle patterns.',
        questions: [
          {
            question: 'What is the average length of a menstrual cycle?',
            options: ['14 days', '28 days', '45 days', '7 days'],
            correct_index: 1,
            explanation: 'While average cycle length is 28 days, a normal range is between 21 and 35 days.'
          }
        ]
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'journal_entry',
      order: 6,
      xp_value: 15,
      is_required: true,
      estimated_minutes: 3,
      payload: {
        prompt: 'What did you learn about your body today that surprised you?',
        sub_prompts: ['How did this shift your perspective?', 'What is one change you want to make?'],
        min_words: 5,
        placeholder_text: 'Reflect and write here...'
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'assessment',
      order: 7,
      xp_value: 30,
      is_required: true,
      estimated_minutes: 5,
      payload: {
        instructions: 'Answer correctly to complete the episode assessment.',
        time_limit_minutes: 10,
        questions: [
          {
            question: 'Which hormone drop triggers menstruation?',
            options: ['Estrogen', 'Progesterone', 'Testosterone', 'Thyroxine'],
            correct_index: 1,
            explanation: 'The drop in progesterone at the end of the luteal phase triggers the shedding of the uterine lining (menstruation).'
          },
          {
            question: 'How long does a typical period flow last?',
            options: ['1 day', '3 to 7 days', '10 to 14 days', 'Over 20 days'],
            correct_index: 1,
            explanation: 'A normal period bleed usually lasts between 3 and 7 days.'
          }
        ],
        pass_threshold: 0.70
      }
    },
    {
      _id: new Types.ObjectId(),
      type: 'summary_card',
      order: 8,
      xp_value: 5,
      is_required: true,
      estimated_minutes: 1,
      payload: {
        key_learnings: [
          'The cycle averages 28 days, but variations are normal.',
          'Hormonal drops trigger the menstrual phase.',
          'Self-reflection helps identify personal patterns.'
        ],
        next_episode_title: `Episode ${episodeNum + 1}`,
        next_episode_teaser: 'Let us dive deeper into logs and calculations!'
      }
    }
  ];
};

export const seedLearningData = async () => {
  try {
    logger.info('Starting learning content seeding...');

    // Clear existing content to ensure clean seeds
    await Journey.deleteMany({});
    await Episode.deleteMany({});
    await Badge.deleteMany({});
    logger.info('Cleared existing journeys, episodes, and badges.');

    // 1. Create Badges
    const badge1 = await Badge.create({
      name: 'Adolescent Journey Champion',
      description: 'Completed the full "My Body, My Story" Learning Journey.',
      image_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809',
      type: 'journey_completion',
      criteria: { journey_slug: 'my-body-my-story' }
    });

    const badge2 = await Badge.create({
      name: 'Adult Cycle Expert',
      description: 'Completed the full "Understanding Your Cycle" Learning Journey.',
      image_url: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf',
      type: 'journey_completion',
      criteria: { journey_slug: 'understanding-your-cycle' }
    });

    logger.info('Created Badges.');

    // 2. Create Journey 1
    const journey1 = await Journey.create({
      title: 'My Body, My Story',
      slug: 'my-body-my-story',
      description: 'A friendly guide to adolescent menstrual health. Learn about what is happening in your body and how to own your story.',
      cover_image_url: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74',
      category: 'adolescent',
      target_audience: ['13-18'],
      tier_required: 'free',
      completion_badge_id: badge1._id,
      estimated_hours: 1.5,
      is_featured: true,
      language: 'en',
      status: 'published',
      total_xp: 300
    });

    // Create episodes for Journey 1
    const j1e1 = await Episode.create({
      journey_id: journey1._id,
      order: 1,
      title: 'What is Menstruation?',
      description: 'An introduction to puberty, cycles, and what to expect.',
      thumbnail_url: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74',
      duration_minutes: 20,
      total_xp: 100,
      is_free: true,
      pass_threshold: 0.70,
      activities: createActivityList(1),
      status: 'published'
    });

    const j1e2 = await Episode.create({
      journey_id: journey1._id,
      order: 2,
      title: 'Tracking Your First Cycle',
      description: 'Learn how to count cycle days and log symptoms.',
      thumbnail_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
      duration_minutes: 20,
      total_xp: 100,
      is_free: true,
      pass_threshold: 0.70,
      activities: createActivityList(2),
      status: 'published'
    });

    const j1e3 = await Episode.create({
      journey_id: journey1._id,
      order: 3,
      title: 'Period Symptoms & Care',
      description: 'How to manage cramps, bloating, and practice self-care.',
      thumbnail_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
      duration_minutes: 20,
      total_xp: 100,
      is_free: false, // Premium gate
      pass_threshold: 0.70,
      activities: createActivityList(3),
      status: 'published'
    });

    journey1.episode_ids = [j1e1._id as Types.ObjectId, j1e2._id as Types.ObjectId, j1e3._id as Types.ObjectId];
    await journey1.save();
    logger.info('Journey 1 ("My Body, My Story") seeded successfully with 3 episodes.');

    // 3. Create Journey 2
    const journey2 = await Journey.create({
      title: 'Understanding Your Cycle',
      slug: 'understanding-your-cycle',
      description: 'A comprehensive, science-backed guide to the adult menstrual cycle, hormone fluctuations, and wellness tips.',
      cover_image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
      category: 'menstrual_health',
      target_audience: ['18-35'],
      tier_required: 'plus', // Journey tier required
      completion_badge_id: badge2._id,
      estimated_hours: 1.5,
      is_featured: false,
      language: 'en',
      status: 'published',
      total_xp: 300
    });

    // Create episodes for Journey 2
    const j2e1 = await Episode.create({
      journey_id: journey2._id,
      order: 1,
      title: 'Hormones & Phases',
      description: 'Understanding estrogen, progesterone, and the four phases.',
      thumbnail_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
      duration_minutes: 20,
      total_xp: 100,
      is_free: true, // Overrides journey tier for first 2 episodes
      pass_threshold: 0.70,
      activities: createActivityList(1),
      status: 'published'
    });

    const j2e2 = await Episode.create({
      journey_id: journey2._id,
      order: 2,
      title: 'Ovulation & Fertility',
      description: 'Learn about the fertile window, egg release, and predictions.',
      thumbnail_url: 'https://images.unsplash.com/photo-1518152006812-edab29b069ac',
      duration_minutes: 20,
      total_xp: 100,
      is_free: true, // Overrides journey tier
      pass_threshold: 0.70,
      activities: createActivityList(2),
      status: 'published'
    });

    const j2e3 = await Episode.create({
      journey_id: journey2._id,
      order: 3,
      title: 'Managing Irregular Cycles',
      description: 'When standard calculations fail, and how to identify patterns.',
      thumbnail_url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7',
      duration_minutes: 20,
      total_xp: 100,
      is_free: false,
      pass_threshold: 0.70,
      activities: createActivityList(3),
      status: 'published'
    });

    journey2.episode_ids = [j2e1._id as Types.ObjectId, j2e2._id as Types.ObjectId, j2e3._id as Types.ObjectId];
    await journey2.save();
    logger.info('Journey 2 ("Understanding Your Cycle") seeded successfully with 3 episodes.');

    logger.info('Learning Journey data seeded successfully!');
  } catch (error: any) {
    logger.error(`Failed to seed learning content: ${error.message}`);
    throw error;
  }
};

// If executing directly via node command line
if (require.main === module) {
  const runSeeding = async () => {
    try {
      await mongoose.connect(MONGO_URI);
      logger.info('Database connected for standalone seed script execution.');
      await seedLearningData();
      await mongoose.disconnect();
      logger.info('Database disconnected. Seeding execution complete.');
      process.exit(0);
    } catch (err: any) {
      logger.error(`Seed script standalone execution failure: ${err.message}`);
      process.exit(1);
    }
  };
  runSeeding();
}
