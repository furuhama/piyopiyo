#!/usr/bin/env ruby

time = Time.now

print 'Input post filename (like `this-is-test-title`) >> '
title = gets.delete("\n")

post_title = time.strftime('%Y-%m-%d-') + title + '.markdown'
post_directory = File.expand_path('../_posts', __FILE__)
target_path = post_directory + '/' + post_title

raise RuntimeError.new "Already exists #{post_title}" if File.exist? target_path

File.open(target_path, 'w') do |f|
  f.puts '---'
  f.puts 'layout: post'
  f.puts 'title: '
  f.puts "date: #{time.strftime('%Y-%m-%d %H:%M:%S')}"
  f.puts 'tag: []'
  f.puts '---'
end

puts "Created: #{post_title}"
